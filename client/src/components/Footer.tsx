export function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 sm:flex-row">
        <a
          href="https://www.criatech.online"
          target="_blank"
          rel="noreferrer"
          className="hover:text-brand-600"
        >
          Powered by <span className="font-medium">CriaTech</span>
        </a>
        <a
          href="https://wa.me/5581996744143"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 font-medium text-green-700 hover:bg-green-100"
        >
          Suporte via WhatsApp
        </a>
      </div>
    </footer>
  )
}
