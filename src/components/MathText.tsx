"use client";

import React, { useEffect, useRef, memo } from 'react';
import 'katex/dist/katex.min.css';
// @ts-ignore
import renderMathInElement from 'katex/dist/contrib/auto-render';

interface MathTextProps {
  text: string;
  className?: string;
}

const MathText = memo(function MathText({ text, className = "" }: MathTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastProcessedText = useRef<string>("");

  // Pre-process text to wrap common math patterns in $ labels and convert shorthand like a/b to \frac{a}{b}
  const processedText = React.useMemo(() => {
    if (!text) return "";
    let res = text;

    // 1. Convert Arabic shorthand "اس" to "^"
    res = res.replace(/\s+اس\s+/g, "^");

    // 2. Multi-pass replacement for fractions and exponents to support nesting
    // We do this up to 3 times to handle nested [ ] [ ] structures
    for (let i = 0; i < 3; i++) {
      // Fractions: [a]/[b] or 5/8 -> \frac{a}{b}
      res = res.replace(/(\[[^\[\]]+\]|[\w\d\.]+)\s*\/\s*(\[[^\[\]]+\]|[\w\d\.]+)/g, (match, p1, p2) => {
        let num = p1.trim();
        let den = p2.trim();
        if (num.startsWith('[') && num.endsWith(']')) num = num.slice(1, -1);
        if (den.startsWith('[') && den.endsWith(']')) den = den.slice(1, -1);
        return `\\frac{${num}}{${den}}`;
      });

      // Exponents: Base^[Exp] or Base^Exp -> Base^{Exp}
      res = res.replace(/(\[[^\[\]]+\]|[\w\d\.]+)\s*\^\s*(\[[^\[\]]+\]|[\w\d\.]+)/g, (match, p1, p2) => {
        let base = p1.trim();
        let exp = p2.trim();
        if (base.startsWith('[') && base.endsWith(']')) base = base.slice(1, -1);
        if (exp.startsWith('[') && exp.endsWith(']')) exp = exp.slice(1, -1);
        return `${base}^{${exp}}`;
      });
    }

    // 3. Final pass: Wrap KaTeX commands in $ delimiters if not already wrapped
    // This looks for \frac or letters/numbers followed by ^{...}
    // We avoid wrapping if already wrapped in $
    res = res.replace(/(?<![\$])(\\frac\{[^\}]+\}\{[^\}]+\}|[\w\d]+\^\{[^\}]+\}|[\w\d]+\^[ \w\d]+)(?![\$])/g, (match) => {
      return `$ ${match} $`;
    });

    return res;
  }, [text]);

  useEffect(() => {
    if (containerRef.current && processedText !== lastProcessedText.current) {
      console.log(`[MathText] Rendering Math for: "${processedText.substring(0, 30)}..."`);
      
      const timer = setTimeout(() => {
        if (!containerRef.current) return;
        try {
          renderMathInElement(containerRef.current, {
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
          });
          lastProcessedText.current = processedText;
          console.log(`[MathText] Successfully rendered processed text`);
        } catch (err) {
          console.error("[MathText] Render Error:", err, "for text:", text);
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [processedText, text]);

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
