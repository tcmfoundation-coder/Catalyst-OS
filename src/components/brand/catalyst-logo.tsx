import Image from "next/image";

export function CatalystLogo({ className }: { className: string }) {
  return (
    <Image
      src="/brand/catalyst-core-mark.svg"
      alt=""
      aria-hidden="true"
      width={1024}
      height={1024}
      unoptimized
      className={className}
    />
  );
}
