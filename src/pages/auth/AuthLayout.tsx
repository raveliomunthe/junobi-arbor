import type { ReactNode } from 'react'

type AuthLayoutProps = {
  title: string
  subtitle?: string
  children: ReactNode
}

export default function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <main className="flex min-h-[111.111111vh] items-center justify-center bg-[#d9d9d9] px-6 py-9 font-['Montserrat',sans-serif] text-[#2d2d2d]">
      <section className="navbar-edge-sheen navbar-shell w-full max-w-[420px] rounded-[36px] bg-[#f4f5f2]/50 p-6 backdrop-blur-[5px]">
        <h1 className="text-center text-[28px] font-black">{title}</h1>
        {subtitle && <p className="mt-2 text-center text-sm font-medium text-[#555555]">{subtitle}</p>}
        <div className="mt-5">{children}</div>
      </section>
    </main>
  )
}
