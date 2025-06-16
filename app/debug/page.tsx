/* eslint-disable no-magic-numbers */
console.log("Environment variables:", process.env);

export default function DebugPage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Debug Page</h1>
      <p className="mb-2">This page is for debugging purposes.</p>
      <p className="mb-2">Environment variables are logged to the console.</p>
      <pre className="mb-2  bg-gray-100 mx-auto max-w-2xl">
        {JSON.stringify(process.env, null, 2)}
      </pre>
    </div>
  );
}
