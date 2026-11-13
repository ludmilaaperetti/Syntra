export function hablar(texto: string): void {
  // TODO: Reemplazar por VoiceService de accesibilidad implementado por Danita.
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(texto));
}
