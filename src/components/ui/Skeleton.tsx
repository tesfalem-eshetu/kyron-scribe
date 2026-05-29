interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number;
  className?: string;
}

export function Skeleton({ width, height = 12, radius, className }: SkeletonProps) {
  return (
    <div
      className={`skel ${className ?? ""}`.trim()}
      style={{
        width,
        height,
        borderRadius: radius,
      }}
      aria-hidden="true"
    />
  );
}
