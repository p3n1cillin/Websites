import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">
          404
        </p>
        <h1 className="mt-2 text-3xl font-extrabold text-gray-900 sm:text-4xl">
          Page not found
        </h1>
        <p className="mt-3 text-gray-600">
          Sorry, we couldn&apos;t find the page you were looking for.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center rounded-full bg-gray-900 px-6 py-3 text-sm font-semibold text-white"
        >
          Back to the directory
        </Link>
      </div>
    </main>
  );
}
