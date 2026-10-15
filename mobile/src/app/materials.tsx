import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { File as ExpoFile } from "expo-file-system";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { confirmMaterialUpload, getAcademicData, getMaterials, retryMaterialProcessing, uploadMaterialRequest, type AcademicData, type MobileMaterial } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { HudPanel } from "@/components/ui/HudPanel";
import { TactileIconTile, TactilePressable } from "@/components/ui/TactilePressable";
import { useToast } from "@/components/ui/ToastProvider";
import { colors, radius, space } from "@/theme/tokens";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

type PickedMaterial =
  | { kind: "native"; file: ExpoFile; name: string; size: number }
  | { kind: "web"; file: globalThis.File; name: string; size: number };

type UploadPhase = "idle" | "preparing" | "uploading" | "confirming";

function pickBrowserFile(): Promise<PickedMaterial | null> {
  if (typeof document === "undefined") return Promise.reject(new Error("The browser file picker is unavailable."));
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.docx,.pptx," + ACCEPTED_MIME_TYPES.join(",");
    input.addEventListener("change", () => {
      const file = input.files?.[0] ?? null;
      input.remove();
      resolve(file ? { kind: "web", file, name: file.name, size: file.size } : null);
    }, { once: true });
    input.addEventListener("cancel", () => { input.remove(); resolve(null); }, { once: true });
    input.click();
  });
}

async function pickNativeFile(): Promise<PickedMaterial | null> {
  const picked = await ExpoFile.pickFileAsync({ mimeTypes: ACCEPTED_MIME_TYPES });
  if (picked.canceled) return null;
  const file = picked.result;
  return { kind: "native", file, name: file.name, size: file.size };
}

function uploadBrowserFile(
  url: string,
  file: globalThis.File,
  contentType: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.timeout = 120_000;
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Storage rejected the upload (HTTP ${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("Could not reach file storage. Check the storage CORS settings and try again."));
    xhr.ontimeout = () => reject(new Error("The upload timed out. Check your connection and try again."));
    xhr.send(file);
  });
}

export default function MaterialsScreen() {
  const { state } = useAuth();
  const { showToast } = useToast();
  const token = state.status === "authenticated" ? state.token : null;
  const [items, setItems] = useState<MobileMaterial[]>([]);
  const [academic, setAcademic] = useState<AcademicData | null>(null);
  const [courseId, setCourseId] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const busy = phase !== "idle";

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [materialsResult, academicResult] = await Promise.allSettled([getMaterials(token), getAcademicData(token)]);
      if (materialsResult.status === "rejected") throw materialsResult.reason;
      setItems(materialsResult.value);
      if (academicResult.status === "fulfilled") {
        setAcademic(academicResult.value);
      } else {
        // Course selection is optional; keep the archive and no-course upload usable.
        setAcademic(null);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load your materials.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const hasInFlight = items.some((material) => material.status === "uploaded" || material.status === "processing");
  const refresh = useCallback(() => {
    setRefreshing(true);
    setError("");
    void load();
  }, [load]);
  useEffect(() => {
    if (!token || !hasInFlight) return;
    const timer = setInterval(() => {
      void getMaterials(token).then(setItems).catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Could not refresh processing status.");
      });
    }, 2500);
    return () => clearInterval(timer);
  }, [hasInFlight, token]);

  if (state.status !== "authenticated") return null;

  async function chooseAndUpload() {
    if (!token) return;
    const authToken = token;
    setError("");
    setNotice("");
    try {
      const picked = Platform.OS === "web" ? await pickBrowserFile() : await pickNativeFile();
      if (!picked) return;
      if (!picked.size) throw new Error("The selected file is empty.");
      if (picked.size > MAX_UPLOAD_BYTES) throw new Error("File is larger than the 25 MB limit.");

      setPhase("preparing");
      setProgress(0);
      const ticket = await uploadMaterialRequest(authToken, { filename: picked.name, sizeBytes: picked.size, courseId });
      setPhase("uploading");

      if (picked.kind === "web") {
        await uploadBrowserFile(ticket.uploadUrl, picked.file, ticket.contentType, setProgress);
      } else {
        const transfer = await picked.file.upload(ticket.uploadUrl, {
          httpMethod: "PUT",
          uploadType: 0,
          headers: { "Content-Type": ticket.contentType },
          onProgress: ({ bytesSent, totalBytes }) => setProgress(totalBytes ? Math.round((bytesSent / totalBytes) * 100) : 0),
        });
        if (transfer.status < 200 || transfer.status >= 300) throw new Error(`Storage rejected the upload (HTTP ${transfer.status}).`);
      }

      setProgress(100);
      setPhase("confirming");
      await confirmMaterialUpload(authToken, { storageKey: ticket.storageKey, originalFilename: picked.name, courseId });
      setNotice("Upload received. Catalysts is extracting and preparing your document.");
      showToast("Upload received. Processing has started.");
      setPhase("idle");
      await load();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Upload failed. Please try again.";
      setError(message);
      showToast(message, "error");
      setPhase("idle");
    }
  }

  async function retryProcessing(material: MobileMaterial) {
    if (!token || retryingId) return;
    const authToken = token;
    setRetryingId(material.id);
    setError("");
    setNotice("");
    try {
      await retryMaterialProcessing(authToken, material.id);
      setNotice("Retry started. Catalysts is processing the document again.");
      showToast("Document processing restarted");
      await load();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not restart document processing.";
      setError(message);
      showToast(message, "error");
    } finally {
      setRetryingId(null);
    }
  }

  const courses = academic?.courses ?? [];
  const phaseText = phase === "preparing" ? "Preparing secure upload…" : phase === "uploading" ? `Uploading · ${progress}%` : phase === "confirming" ? "Registering document…" : "";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.lime} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹  COMMAND CENTER</Text></Pressable>
        <Text style={styles.eyebrow}>KNOWLEDGE ARCHIVE</Text>
        <Text style={styles.title}>Study materials</Text>
        <Text style={styles.subtitle}>Add lecture files to Catalysts. We extract their text for Tutor and study notes.</Text>

        <HudPanel style={styles.upload}>
          <Text style={styles.heading}>Add a material</Text>
          <Text style={styles.copy}>PDF, Word, or PowerPoint · up to 25 MB</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Pressable accessibilityRole="button" onPress={() => setCourseId("")} style={[styles.chip, !courseId && styles.chipOn]}><Text style={[styles.chipText, !courseId && styles.chipTextOn]}>No course</Text></Pressable>
            {courses.map((course) => <Pressable accessibilityRole="button" key={course.id} onPress={() => setCourseId(course.id)} style={[styles.chip, courseId === course.id && styles.chipOn]}><Text style={[styles.chipText, courseId === course.id && styles.chipTextOn]}>{course.code}</Text></Pressable>)}
          </ScrollView>
          <TactilePressable accessibilityRole="button" disabled={busy} onPress={() => void chooseAndUpload()} style={[styles.button, busy && styles.buttonPressed]}>
            {busy ? <ActivityIndicator color={colors.black} size="small" /> : null}
            <Text style={styles.buttonText}>{busy ? phaseText : "Choose a file"}</Text>
          </TactilePressable>
          {phase === "uploading" ? <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View> : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        </HudPanel>

        {error ? <HudPanel style={styles.errorPanel}><Text style={styles.error}>{error}</Text></HudPanel> : null}
        <View style={styles.libraryHeader}><Text style={styles.section}>YOUR LIBRARY</Text><Text style={styles.count}>{items.length} MATERIALS</Text></View>

        {loading && !items.length ? <HudPanel style={styles.empty}><ActivityIndicator color={colors.lime} /><Text style={styles.copy}>Loading your archive…</Text></HudPanel> : null}
        {!loading && !items.length ? <HudPanel style={styles.empty}><Text style={styles.heading}>Your archive is clear</Text><Text style={styles.copy}>Uploaded documents will appear here with live extraction status.</Text></HudPanel> : null}
        {items.map((material) => (
          <HudPanel key={material.id} style={styles.material}>
            <View style={styles.materialTop}>
              <TactileIconTile color={colors.cyan} size={40}><Text style={styles.fileType}>{material.format.toUpperCase()}</Text></TactileIconTile>
              <Text style={[styles.status, material.status === "ready" ? styles.ready : material.status === "failed" || material.status === "needs_ocr" ? styles.failed : styles.processing]}>{material.status.replaceAll("_", " ").toUpperCase()}</Text>
            </View>
            <Text numberOfLines={2} style={styles.fileName}>{material.title || material.filename}</Text>
            <Text style={styles.copy}>{[material.courseCode, `${(material.sizeBytes / 1024 / 1024).toFixed(1)} MB`, new Date(material.createdAt).toLocaleDateString()].filter(Boolean).join(" · ")}</Text>
            {material.status === "processing" || material.status === "uploaded" ? <Text style={styles.processingHint}>Extracting text and preparing this document…</Text> : null}
            {material.status === "needs_ocr" ? <Text style={styles.error}>This scan needs OCR before its text can be used. OCR is not available yet.</Text> : null}
            {material.processingError ? <Text style={styles.error}>{material.processingError}</Text> : null}
            {material.status === "failed" ? <TactilePressable accessibilityRole="button" disabled={retryingId !== null} onPress={() => void retryProcessing(material)} style={styles.retryButton}><Text style={styles.retryText}>{retryingId === material.id ? "Restarting…" : "Retry processing"}</Text></TactilePressable> : null}
            {material.status === "ready" ? <Pressable accessibilityRole="button" onPress={() => router.push("/study-notes")}><Text style={styles.link}>Generate study notes →</Text></Pressable> : null}
          </HudPanel>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", padding: space.xl, paddingBottom: space.xxxl, gap: space.md },
  back: { color: colors.cyan, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  eyebrow: { color: colors.lime, fontSize: 9, fontWeight: "800", letterSpacing: 1.4, marginTop: 8 },
  title: { color: colors.foreground, fontSize: 28, fontWeight: "800", marginTop: -9 },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: -8 },
  upload: { gap: 11, borderColor: `${colors.lime}45`, borderTopColor: `${colors.lime}75`, backgroundColor: "#0D171A" },
  heading: { color: colors.foreground, fontSize: 15, fontWeight: "700" },
  copy: { color: colors.muted, fontSize: 10, lineHeight: 16 },
  chips: { gap: 7, paddingVertical: 2 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, backgroundColor: "#080F14", paddingVertical: 8, paddingHorizontal: 11 },
  chipOn: { borderColor: colors.cyan, backgroundColor: `${colors.cyan}18` },
  chipText: { color: colors.muted, fontSize: 9, fontWeight: "700" },
  chipTextOn: { color: colors.cyan },
  button: { minHeight: 45, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: radius.control, borderWidth: 1, borderTopColor: "#E0FFA9", borderLeftColor: colors.lime, borderRightColor: "#88B648", borderBottomColor: "#779E42", backgroundColor: colors.lime, paddingHorizontal: 13, paddingVertical: 11, shadowColor: colors.lime, shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  buttonPressed: { opacity: 0.76 },
  buttonText: { color: colors.black, fontSize: 11, fontWeight: "900" },
  progressTrack: { height: 7, overflow: "hidden", borderRadius: 4, borderWidth: 1, borderColor: "#243239", backgroundColor: "#070D10", padding: 1 },
  progressFill: { height: "100%", borderRadius: 3, backgroundColor: colors.cyan },
  notice: { color: colors.lime, fontSize: 10, lineHeight: 15 },
  errorPanel: { borderColor: `${colors.danger}55` },
  error: { color: colors.danger, fontSize: 10, lineHeight: 15 },
  libraryHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  section: { color: colors.lime, fontSize: 9, fontWeight: "900", letterSpacing: 1.4 },
  count: { color: colors.subtle, fontSize: 8, fontWeight: "800", letterSpacing: 0.7 },
  empty: { minHeight: 85, alignItems: "center", justifyContent: "center", gap: 8 },
  material: { gap: 8, borderColor: "#2C3A43", borderTopColor: "#4B5D65", backgroundColor: colors.surface, shadowColor: colors.black, shadowOpacity: 0.6, shadowRadius: 7, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  materialTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  typeBadge: { borderWidth: 1, borderColor: `${colors.cyan}35`, borderRadius: 6, backgroundColor: "#09151A", paddingHorizontal: 7, paddingVertical: 4 },
  fileType: { color: colors.cyan, fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  status: { fontSize: 8, fontWeight: "900", letterSpacing: 0.7 },
  processing: { color: colors.amber },
  ready: { color: colors.lime },
  failed: { color: colors.danger },
  fileName: { color: colors.foreground, fontSize: 12, fontWeight: "800" },
  processingHint: { color: colors.amber, fontSize: 9, lineHeight: 14 },
  link: { color: colors.cyan, fontSize: 10, fontWeight: "800", marginTop: 2 },
  retryButton: { alignSelf: "flex-start", borderWidth: 1, borderColor: `${colors.amber}70`, borderRadius: radius.pill, backgroundColor: "#211A10", paddingHorizontal: 11, paddingVertical: 7, marginTop: 2 },
  retryText: { color: colors.amber, fontSize: 9, fontWeight: "800" },
});
