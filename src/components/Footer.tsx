export default function Footer() {
  return (
    <footer className="bg-white border-t mt-auto">
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8 flex flex-col items-center">
        <p className="text-gray-500 text-sm">
          © {new Date().getFullYear()} BlogPlatform. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
