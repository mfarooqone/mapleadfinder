export type BannerType = "success" | "error" | "info";

export type BannerState = {
  type: BannerType;
  message: string;
} | null;

export default function StatusBanner({ banner }: { banner: BannerState }) {
  if (!banner) return null;

  const className =
    banner.type === "success"
      ? "alert alert-success"
      : banner.type === "error"
        ? "alert alert-error"
        : "alert alert-info";

  return <div className={className}>{banner.message}</div>;
}
