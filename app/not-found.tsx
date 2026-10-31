import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-5xl font-semibold text-primary">404</p>
      <p className="text-muted-foreground">We couldn&apos;t find that page or record.</p>
      <Link href="/" className="text-sm text-primary hover:underline">Go home</Link>
    </div>
  );
}
