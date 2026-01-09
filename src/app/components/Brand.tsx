"use client";

export function Brand({ href = '/dashboard' }: { href?: string }) {
    return (
        <a href={href} aria-label="Go to dashboard" className="flex items-center gap-3">
            <img
                src="/luh_logo.png"
                alt="Let Us Hack"
                width={32}
                height={32}
                className="w-8 h-8 rounded object-cover mr-2"
                loading="eager"
                decoding="async"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/luh_logo.ico'; }}
            />
            <span className="text-white text-xl font-semibold">Let Us Hack</span>
        </a>
    );
}

export default Brand;
