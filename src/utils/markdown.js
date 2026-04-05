// src/utils/markdown.js

/**
 * Utilitário simples para converter Markdown (limitado) em HTML.
 * Preserva o comportamento original do monolito.
 */
export const Markdown = {
  render(md) {
    if (!md) return '';
    let h = md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/^### (.*$)/gim, '<div class="md-h3">$1</div>')
      .replace(/^## (.*$)/gim, '<div class="md-h2">$1</div>')
      .replace(/^# (.*$)/gim, '<div class="md-h1">$1</div>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/`(.*?)`/gim, '<code class="md-code">$1</code>')
      .replace(/\n/gim, '<br>');
    
    // Simplistic handling of lists if needed, but the original was very basic
    return h;
  }
};
