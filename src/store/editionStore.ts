import { create } from 'zustand';

/** Chave usada para persistir a edição atual no localStorage. */
const STORAGE_KEY = 'bolao.currentEdition';

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(id: string | null) {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignora ambientes sem localStorage */
  }
}

interface EditionState {
  currentEditionId: string | null;
  setCurrentEdition: (id: string | null) => void;
}

/** Estado global da edição selecionada (Zustand), persistido em localStorage. */
export const useEditionStore = create<EditionState>((set) => ({
  currentEditionId: readStored(),
  setCurrentEdition: (id) => {
    writeStored(id);
    set({ currentEditionId: id });
  },
}));
