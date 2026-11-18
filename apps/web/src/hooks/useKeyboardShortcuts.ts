import { useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

export function useKeyboardShortcuts(enabled: boolean) {
  const setCommandPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const openCreateTaskModal = useUIStore((s) => s.openCreateTaskModal);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!useUIStore.getState().commandPaletteOpen);
        return;
      }

      if (isEditableTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        openCreateTaskModal();
      } else if (e.key === '[') {
        e.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, setCommandPaletteOpen, openCreateTaskModal, toggleSidebar]);
}
