import { useState } from 'react'
import { useFlash } from '../transactions/formHooks'
import { useDataStore } from '../../data/hooks'

// Two-step reset for the local demo data, shown in the profile popup.
export default function DemoDataReset() {
  const store = useDataStore()
  const [confirming, setConfirming] = useState(false)
  const flash = useFlash()

  return (
    <div className="mt-3 border-t border-[#2d2d2d]/10 pt-3">
      <p className="text-xs font-bold text-[#555555]">Demo data</p>
      <p className="mt-1 text-xs text-[#555555]">Stored in this browser for the current workspace.</p>
      {confirming ? (
        <div className="mt-2">
          <p className="text-xs font-bold">Replace all demo data with the original sample data?</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                store.resetDemoData()
                setConfirming(false)
                flash.show('Demo data has been reset.')
              }}
              className="flex-1 rounded-full bg-[#b3261e] px-3 py-2 text-xs font-bold text-white transition-[transform,opacity] hover:opacity-90 active:scale-[0.97]"
            >
              Yes, reset
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="flex-1 rounded-full bg-white/60 px-3 py-2 text-xs font-bold transition-[transform,background-color] hover:bg-white/80 active:scale-[0.97]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            flash.clear()
            setConfirming(true)
          }}
          className="mt-2 w-full rounded-full bg-white/60 px-4 py-2 text-xs font-bold transition-[transform,background-color] hover:bg-white/80 active:scale-[0.97]"
        >
          Reset demo data
        </button>
      )}
      {flash.message && <p role="status" className="mt-2 text-xs font-bold text-[#1f7a4d]">{flash.message}</p>}
    </div>
  )
}
