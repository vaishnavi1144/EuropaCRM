import React from 'react';

/**
 * Transforms string so every word has its first letter capitalized
 * and subsequent letters lowercase, preserving all spacing and punctuation.
 *
 * Example:
 * "s" -> "S"
 * "sa" -> "Sa"
 * "sai " -> "Sai "
 * "sai kumar" -> "Sai Kumar"
 * "JOHN DOE" -> "John Doe"
 */
export function toTitleCase(val: string): string {
  if (!val || typeof val !== 'string') return val ?? '';
  return val.replace(/([^\s]+)/g, (word) => {
    return word.replace(/^([^a-zA-Z0-9]*)([a-zA-Z0-9])/, (_, prefix, first) => {
      return prefix + first.toUpperCase();
    });
  });
}

/**
 * Determines whether a given field configuration should have Title Case formatting.
 * Skips emails, passwords, URLs, reference IDs, and codes.
 */
export function shouldTitleCaseField(field: { key?: string; type?: string; label?: string }): boolean {
  const type = field.type ?? 'text';
  if (type !== 'text' && type !== 'textarea') return false;

  const key = (field.key ?? '').toLowerCase();
  const label = (field.label ?? '').toLowerCase();

  // Exclude email fields
  if (key.includes('email') || label.includes('email')) {
    return false;
  }

  // Exclude password fields
  if (key.includes('password') || label.includes('password')) {
    return false;
  }

  // Exclude URLs, websites, links
  if (key.includes('url') || key.includes('website') || key.includes('link') || label.includes('url') || label.includes('website')) {
    return false;
  }

  // Exclude technical identifiers, usernames, codes, references
  if (key === 'username' || key.endsWith('id') || key.includes('reference') || key.includes('code')) {
    return false;
  }

  return true;
}

/**
 * Helper to handle change events on inputs/textareas, applying Title Case
 * and maintaining cursor position.
 */
export function handleTitleCaseChange(
  e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  onChange: (val: string) => void,
  enabled = true,
) {
  const target = e.target;
  const rawValue = target.value;

  if (!enabled) {
    onChange(rawValue);
    return;
  }

  const start = target.selectionStart;
  const end = target.selectionEnd;
  const formatted = toTitleCase(rawValue);

  onChange(formatted);

  if (start !== null && end !== null) {
    requestAnimationFrame(() => {
      target.setSelectionRange(start, end);
    });
  }
}
