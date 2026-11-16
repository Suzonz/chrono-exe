import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto mt-xl max-w-xl border border-error bg-surface-container-lowest p-lg">
      <div className="text-h2 text-error">ERROR_404</div>
      <div className="mt-sm text-label text-error">{"// ROUTE NOT FOUND"}</div>
      <pre className="mt-lg whitespace-pre-wrap text-ui-small leading-relaxed text-on-surface-variant">
        {"> RESOLVING PATH... FAILED\n> SEGMENT DOES NOT EXIST IN THIS FILESYSTEM\n> SUGGESTED ACTION: RETURN TO ROOT"}
      </pre>
      <Link href="/" className="mt-lg inline-block border border-primary-container px-md py-sm text-label text-primary hover:bg-surface-container-highest">
        {"< BACK TO TODAY"}
      </Link>
    </section>
  );
}
