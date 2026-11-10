import { createContext } from 'react'
import type { DemoStore } from './store'

export const DataContext = createContext<DemoStore | null>(null)
