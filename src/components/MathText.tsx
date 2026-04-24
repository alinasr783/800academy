"use client";

import React, { useEffect, useRef, memo } from 'react';
import 'katex/dist/katex.min.css';
// @ts-ignore
import renderMathInElement from 'katex/dist/contrib/auto-render';

interface MathTextProps {
  text: string;
  className?: string;
}

const KATEX_OPTIONS = {
  delimiters: [
    { left: '$$', right: '$$', display: true },
    { left: '$', right: '$', display: false },
    { left: '\\(', right: '\\)', display: false },
    { left: '\\[', right: '\\]', display: true },
    { left: '\\begin{equation}', right: '\\end{equation}', display: true },
    { left: '\\begin{align}', right: '\\end{align}', display: true },
    { left: '\\begin{alignat}', right: '\\end{alignat}', display: true },
    { left: '\\begin{gather}', right: '\\end{gather}', display: true },
    { left: '\\begin{CD}', right: '\\end{CD}', display: true },
  ],
  throwOnError: false,
  trust: true,
  strict: false,
  ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code", "option"],
} as const;

// ─── Bracket & Brace helpers ─────────────────────────────────────────

function findClosingBracket(str: string, openPos: number): number {
  let depth = 1;
  for (let i = openPos + 1; i < str.length; i++) {
    if (str[i] === '[') depth++;
    else if (str[i] === ']') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

function findClosingBrace(str: string, openPos: number): number {
  let depth = 1;
  for (let i = openPos + 1; i < str.length; i++) {
    if (str[i] === '{') depth++;
    else if (str[i] === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

// ─── Phase 1: Bracket-aware structural parsing ──────────────────────

function processBracketedOps(str: string): string {
  let result = '', i = 0;
  while (i < str.length) {
    if ((str[i] === '^' || str[i] === '_')) {
      const op = str[i];
      let j = i + 1;
      while (j < str.length && str[j] === ' ') j++;
      if (j < str.length && str[j] === '[') {
        const close = findClosingBracket(str, j);
        if (close !== -1) {
          result += `${op}{${str.substring(j + 1, close)}}`;
          i = close + 1;
          continue;
        }
      }
    }
    result += str[i]; i++;
  }
  return result;
}

function processBracketedFractions(str: string): string {
  let result = '', i = 0;
  while (i < str.length) {
    if (str[i] === '[') {
      const numClose = findClosingBracket(str, i);
      if (numClose !== -1) {
        let j = numClose + 1;
        while (j < str.length && str[j] === ' ') j++;
        if (j < str.length && str[j] === '/') {
          let k = j + 1;
          while (k < str.length && str[k] === ' ') k++;
          if (k < str.length && str[k] === '[') {
            const denClose = findClosingBracket(str, k);
            if (denClose !== -1) {
              result += `\\frac{${str.substring(i + 1, numClose)}}{${str.substring(k + 1, denClose)}}`;
              i = denClose + 1;
              continue;
            }
          }
        }
      }
    }
    result += str[i]; i++;
  }
  return result;
}

function processBracketedFunc(str: string, name: string, latex: string): string {
  let result = '', i = 0;
  while (i < str.length) {
    if (str.substring(i, i + name.length) === name) {
      // Make sure this is not part of a longer word (e.g., "sqrt" inside "nroot")
      const prevChar = i > 0 ? str[i - 1] : '';
      if (/[a-zA-Z]/.test(prevChar)) {
        result += str[i]; i++;
        continue;
      }
      let j = i + name.length;
      while (j < str.length && str[j] === ' ') j++;
      if (j < str.length && str[j] === '[') {
        const close = findClosingBracket(str, j);
        if (close !== -1) {
          result += `${latex}{${str.substring(j + 1, close)}}`;
          i = close + 1;
          continue;
        }
      }
    }
    result += str[i]; i++;
  }
  return result;
}

// nroot[n][x] → \sqrt[n]{x}
function processNthRoot(str: string): string {
  let result = '', i = 0;
  while (i < str.length) {
    if (str.substring(i, i + 5) === 'nroot') {
      let j = i + 5;
      while (j < str.length && str[j] === ' ') j++;
      if (j < str.length && str[j] === '[') {
        const nClose = findClosingBracket(str, j);
        if (nClose !== -1) {
          let k = nClose + 1;
          while (k < str.length && str[k] === ' ') k++;
          if (k < str.length && str[k] === '[') {
            const xClose = findClosingBracket(str, k);
            if (xClose !== -1) {
              const n = str.substring(j + 1, nClose);
              const x = str.substring(k + 1, xClose);
              result += `$\\sqrt[${n}]{${x}}$`;
              i = xClose + 1;
              continue;
            }
          }
        }
      }
    }
    result += str[i]; i++;
  }
  return result;
}

// abs[x] → |x| (or \left|x\right| for better rendering)
function processAbs(str: string): string {
  let result = '', i = 0;
  while (i < str.length) {
    if (str.substring(i, i + 3) === 'abs') {
      // Don't match if part of a longer word
      const prevChar = i > 0 ? str[i - 1] : '';
      if (/[a-zA-Z]/.test(prevChar)) {
        result += str[i]; i++;
        continue;
      }
      let j = i + 3;
      while (j < str.length && str[j] === ' ') j++;
      if (j < str.length && str[j] === '[') {
        const close = findClosingBracket(str, j);
        if (close !== -1) {
          result += `$\\lvert ${str.substring(j + 1, close)} \\rvert$`;
          i = close + 1;
          continue;
        }
      }
    }
    result += str[i]; i++;
  }
  return result;
}

// ─── Phase 2: Mixed fractions (one side bracketed, other simple) ─────
// Handles: simple/[bracket] and [bracket]/simple

function processMixedFractions(str: string): string {
  let result = '', i = 0;
  while (i < str.length) {
    // Case A: [bracket]/simple  (e.g., [x^2+1]/2)
    if (str[i] === '[') {
      const numClose = findClosingBracket(str, i);
      if (numClose !== -1) {
        let j = numClose + 1;
        while (j < str.length && str[j] === ' ') j++;
        if (j < str.length && str[j] === '/') {
          let k = j + 1;
          while (k < str.length && str[k] === ' ') k++;
          // Check if denominator is a simple token (not another bracket — that's handled by processBracketedFractions)
          if (k < str.length && /[a-zA-Z0-9.]/.test(str[k]) && str[k] !== '[') {
            const tokenStart = k;
            while (k < str.length && /[a-zA-Z0-9.]/.test(str[k])) k++;
            result += `\\frac{${str.substring(i + 1, numClose)}}{${str.substring(tokenStart, k)}}`;
            i = k;
            continue;
          }
        }
      }
    }

    // Case B: simple/[bracket]  (e.g., 1/[7^{6x}])
    if (/[a-zA-Z0-9.]/.test(str[i])) {
      const tokenStart = i;
      while (i < str.length && /[a-zA-Z0-9.]/.test(str[i])) i++;
      const token = str.substring(tokenStart, i);

      let j = i;
      while (j < str.length && str[j] === ' ') j++;
      if (j < str.length && str[j] === '/') {
        let k = j + 1;
        while (k < str.length && str[k] === ' ') k++;
        if (k < str.length && str[k] === '[') {
          const denClose = findClosingBracket(str, k);
          if (denClose !== -1) {
            result += `\\frac{${token}}{${str.substring(k + 1, denClose)}}`;
            i = denClose + 1;
            continue;
          }
        }
      }
      // Not a fraction, just add the token
      result += token;
      continue;
    }

    result += str[i]; i++;
  }
  return result;
}

// ─── Phase 3: Simple regex fallbacks ─────────────────────────────────

function processSimpleFractions(str: string): string {
  return str.replace(/([\w\d\.]+)\s*\/\s*([\w\d\.]+)/g, (_, n, d) => `\\frac{${n.trim()}}{${d.trim()}}`);
}

function processSimpleExponents(str: string): string {
  return str.replace(/([\w\d\.\)\}])\s*\^\s*(-?[\w\d\.]+)/g, (_, b, e) => `${b}^{${e}}`);
}

// ─── Phase 3: Symbol shortcuts ───────────────────────────────────────

function processSymbols(str: string): string {
  let r = str;
  // Greek letters
  const greeks: [RegExp, string][] = [
    [/\balpha\b/gi, '\\alpha '], [/\bbeta\b/gi, '\\beta '], [/\bgamma\b/gi, '\\gamma '],
    [/\bdelta\b/gi, '\\delta '], [/\bepsilon\b/gi, '\\epsilon '], [/\btheta\b/gi, '\\theta '],
    [/\blambda\b/gi, '\\lambda '], [/\bmu\b/g, '\\mu '], [/\bsigma\b/gi, '\\sigma '],
    [/\bomega\b/gi, '\\omega '], [/\bpi\b/g, '\\pi '], [/\bphi\b/gi, '\\phi '],
    [/\btau\b/gi, '\\tau '], [/\brho\b/gi, '\\rho '], [/\beta\b/gi, '\\eta '],
  ];
  greeks.forEach(([rx, rep]) => { r = r.replace(rx, rep); });

  // Relations & operators
  r = r.replace(/<->/g, '\\leftrightarrow ');
  r = r.replace(/->/g, '\\rightarrow ');
  r = r.replace(/<-/g, '\\leftarrow ');
  r = r.replace(/>=/g, '\\geq ');
  r = r.replace(/<=/g, '\\leq ');
  r = r.replace(/!=/g, '\\neq ');
  r = r.replace(/~=/g, '\\approx ');
  r = r.replace(/\+\-/g, '\\pm ');
  r = r.replace(/-\+/g, '\\mp ');
  r = r.replace(/\bcdot\b/g, '\\cdot ');
  r = r.replace(/\btimes\b/gi, '\\times ');
  r = r.replace(/\bdiv\b/gi, '\\div ');
  r = r.replace(/\binfinity\b/gi, '\\infty ');
  r = r.replace(/\binf\b/gi, '\\infty ');
  r = r.replace(/\bdeg\b/g, '^{\\circ}');
  r = r.replace(/\bangle\b/gi, '\\angle ');
  r = r.replace(/\bperp\b/gi, '\\perp ');
  r = r.replace(/\bparallel\b/gi, '\\parallel ');
  // Dots
  r = r.replace(/\.\.\./g, '\\ldots ');
  return r;
}

// ─── Phase 4: Brace-aware $ wrapping (THE FIX) ──────────────────────
// Uses character-by-character parsing with brace depth tracking
// instead of regex, so nested braces like \frac{-2x}{x} inside ^{} work.

function consumeBraceGroups(str: string, pos: number): number {
  let i = pos;
  while (i < str.length) {
    while (i < str.length && str[i] === ' ') i++;
    if (i < str.length && str[i] === '{') {
      const close = findClosingBrace(str, i);
      if (close === -1) break;
      i = close + 1;
    } else break;
  }
  return i;
}

function consumeSupSub(str: string, pos: number): number {
  let i = pos;
  while (i < str.length && (str[i] === '^' || str[i] === '_')) {
    let j = i + 1;
    while (j < str.length && str[j] === ' ') j++;
    if (j < str.length && str[j] === '{') {
      const close = findClosingBrace(str, j);
      if (close === -1) break;
      i = close + 1;
    } else break;
  }
  return i;
}

function wrapLatexDelimiters(str: string): string {
  let result = '', i = 0;

  while (i < str.length) {
    // Skip existing $$...$$ (display mode) — must check BEFORE single $
    if (str[i] === '$' && i + 1 < str.length && str[i + 1] === '$') {
      let j = i + 2;
      // Find closing $$
      while (j < str.length - 1) {
        if (str[j] === '$' && str[j + 1] === '$') break;
        j++;
      }
      result += str.substring(i, j + 2);
      i = j + 2;
      continue;
    }

    // Skip existing $...$ (inline mode)
    if (str[i] === '$') {
      let j = i + 1;
      while (j < str.length && str[j] !== '$') j++;
      result += str.substring(i, Math.min(j + 1, str.length));
      i = j + 1;
      continue;
    }

    // Case 1: \command (like \frac, \sqrt, \alpha, \left|, \right|, etc.)
    if (str[i] === '\\' && i + 1 < str.length && /[a-zA-Z]/.test(str[i + 1])) {
      const start = i;
      i++;
      while (i < str.length && /[a-zA-Z]/.test(str[i])) i++;
      const cmdName = str.substring(start + 1, i);
      // \left and \right consume the next delimiter character (|, (, ), [, ], etc.)
      if ((cmdName === 'left' || cmdName === 'right') && i < str.length) {
        i++; // consume the delimiter char like | ( ) [ ]
      }
      i = consumeBraceGroups(str, i);
      // After \left|...\right|, check if the next thing is another \command (like \right)
      // to combine them into one expression
      while (i < str.length && str[i] === '\\' && i + 1 < str.length && /[a-zA-Z]/.test(str[i + 1])) {
        const innerStart = i;
        i++;
        while (i < str.length && /[a-zA-Z]/.test(str[i])) i++;
        const innerCmd = str.substring(innerStart + 1, i);
        if ((innerCmd === 'left' || innerCmd === 'right') && i < str.length) {
          i++;
        }
        i = consumeBraceGroups(str, i);
      }
      i = consumeSupSub(str, i);
      result += `$ ${str.substring(start, i)} $`;
      continue;
    }

    // Case 2: word/digit followed by ^{} or _{}
    // Use [a-zA-Z0-9.] instead of \w to exclude _ from word chars
    if (/[a-zA-Z0-9.]/.test(str[i])) {
      const start = i;
      while (i < str.length && /[a-zA-Z0-9.]/.test(str[i])) i++;
      // Allow optional whitespace before ^/_ (for Arabic "اس" which leaves a space)
      let tryPos = i;
      while (tryPos < str.length && str[tryPos] === ' ') tryPos++;
      if (tryPos < str.length && (str[tryPos] === '^' || str[tryPos] === '_')) {
        const afterSupSub = consumeSupSub(str, tryPos);
        if (afterSupSub > tryPos) {
          i = afterSupSub;
          result += `$ ${str.substring(start, i).replace(/\s+/g, '')} $`;
          continue;
        }
      }
      const afterWord = consumeSupSub(str, i);
      if (afterWord > i) {
        i = afterWord;
        result += `$ ${str.substring(start, i)} $`;
      } else {
        result += str.substring(start, i);
      }
      continue;
    }

    result += str[i]; i++;
  }
  return result;
}

// ─── Table processing ────────────────────────────────────────────────
// Syntax:  {table} row1col1 | row1col2 \n row2col1 | row2col2 {/table}
// First row is the header. Each | separates columns.

const TABLE_CELL_STYLE = 'border:1px solid #cbd5e1;padding:8px 14px;text-align:center;';
const TABLE_HEADER_STYLE = TABLE_CELL_STYLE + 'background:#f1f5f9;font-weight:700;';
const TABLE_STYLE = 'border-collapse:collapse;margin:10px 0;width:auto;font-size:inherit;';

function processSingleCellMath(cell: string): string {
  let r = cell;
  r = r.replace(/\s+اس\s+/g, " ^ ");
  r = r.replace(/جذر/g, "sqrt");
  r = processNthRoot(r);
  r = processAbs(r);
  for (let pass = 0; pass < 5; pass++) {
    const prev = r;
    r = processBracketedFunc(r, 'sqrt', '\\sqrt');
    r = processBracketedOps(r);
    r = processBracketedFractions(r);
    r = processMixedFractions(r);
    r = processSimpleFractions(r);
    r = processSimpleExponents(r);
    if (r === prev) break;
  }
  r = processSymbols(r);
  r = wrapLatexDelimiters(r);
  return r;
}

function processTables(str: string): string {
  return str.replace(/\{table\}([\s\S]*?)\{\/table\}/gi, (_match, content: string) => {
    const lines = content.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return '';

    let html = `<table style="${TABLE_STYLE}">`;

    lines.forEach((line, idx) => {
      // Split by | and trim, filter empty edge cells from |col1|col2| style
      const cells = line.split('|').map(c => c.trim()).filter((c, ci, arr) => {
        // Remove empty first/last entries (from leading/trailing |)
        if (ci === 0 && c === '') return false;
        if (ci === arr.length - 1 && c === '') return false;
        return true;
      });
      if (cells.length === 0) return;

      const isHeader = idx === 0;
      const tag = isHeader ? 'th' : 'td';
      const style = isHeader ? TABLE_HEADER_STYLE : TABLE_CELL_STYLE;

      if (idx === 0) html += '<thead>';
      else if (idx === 1) html += '<tbody>';

      html += '<tr>';
      cells.forEach(cell => {
        const processed = processSingleCellMath(cell);
        html += `<${tag} style="${style}">${processed}</${tag}>`;
      });
      html += '</tr>';

      if (idx === 0) html += '</thead>';
    });

    if (lines.length > 1) html += '</tbody>';
    html += '</table>';
    return html;
  });
}

// ─── System of equations processing ──────────────────────────────────
// Syntax:  {sys} equation1 \n equation2 \n ... {/sys}
// Renders with a left curly brace grouping all equations (LaTeX cases environment)

function processEquationLine(line: string): string {
  let r = line;
  r = r.replace(/\s+اس\s+/g, " ^ ");
  r = r.replace(/جذر/g, "sqrt");
  r = processNthRoot(r);
  r = processAbs(r);
  for (let pass = 0; pass < 5; pass++) {
    const prev = r;
    r = processBracketedFunc(r, 'sqrt', '\\sqrt');
    r = processBracketedOps(r);
    r = processBracketedFractions(r);
    r = processMixedFractions(r);
    r = processSimpleFractions(r);
    r = processSimpleExponents(r);
    if (r === prev) break;
  }
  r = processSymbols(r);
  return r;
}

function processSystems(str: string): string {
  return str.replace(/\{sys\}([\s\S]*?)\{\/sys\}/gi, (_match, content: string) => {
    const lines = content.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return '';

    const processedLines = lines.map(line => processEquationLine(line));
    const casesContent = processedLines.join(' \\\\ ');
    return `$$\\begin{cases} ${casesContent} \\end{cases}$$`;
  });
}

// ─── Main processText ────────────────────────────────────────────────

function processText(text: string): string {
  if (!text) return "";
  let res = text;

  // Step 1: Extract & process block-level structures first
  res = processTables(res);
  res = processSystems(res);

  // Step 2: Process remaining (non-table) math
  // Arabic shortcuts
  res = res.replace(/\s+اس\s+/g, " ^ ");
  res = res.replace(/جذر/g, "sqrt");

  // Pre-process functions that produce pre-wrapped $ output (must run before the loop)
  res = processNthRoot(res);
  res = processAbs(res);

  // Multi-pass bracket-aware processing
  for (let pass = 0; pass < 5; pass++) {
    const prev = res;
    res = processBracketedFunc(res, 'sqrt', '\\sqrt');
    res = processBracketedOps(res);          // ^[...] → ^{...}, _[...] → _{...}
    res = processBracketedFractions(res);    // [a]/[b] → \frac{a}{b}
    res = processMixedFractions(res);        // simple/[b] or [a]/simple → \frac{}{}
    res = processSimpleFractions(res);       // a/b → \frac{a}{b}
    res = processSimpleExponents(res);       // x^2, x^-3 → x^{2}, x^{-3}
    if (res === prev) break;
  }

  res = processSymbols(res);
  res = wrapLatexDelimiters(res);
  return res;
}

// ─── React Component ─────────────────────────────────────────────────

const MathText = memo(function MathText({ text, className = "" }: MathTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastProcessedText = useRef<string>("");

  const processedText = React.useMemo(() => processText(text), [text]);

  useEffect(() => {
    if (containerRef.current && processedText !== lastProcessedText.current) {
      const rafId = requestAnimationFrame(() => {
        if (!containerRef.current) return;
        try {
          renderMathInElement(containerRef.current, KATEX_OPTIONS);
          lastProcessedText.current = processedText;
        } catch (err) {
          // Silently fail
        }
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [processedText]);

  if (!text) return null;

  return (
    <div
      ref={containerRef}
      className={`math-text-container ${className}`}
      dangerouslySetInnerHTML={{ __html: processedText }}
    />
  );
});

export default MathText;
