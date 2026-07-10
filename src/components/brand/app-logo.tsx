import Image from "next/image";

type AppLogoProps = {
  className?: string;
  size?: number;
  priority?: boolean;
};

export function AppLogo({
  className,
  size = 72,
  priority = false,
}: AppLogoProps) {
  return (
    <Image
      src="/brand/logo.png"
      alt="PrivateFleet"
      width={size}
      height={size}
      priority={priority}
      className={className}
    />
  );
}
