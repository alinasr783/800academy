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

    // 1. Convert shorthand fractions like [complex-expression]/[complex-expression] or 5/8 to \frac{a}{b}
    // We use square brackets [ ] for complex numerators/denominators to allow ( ) inside them.
    res = res.replace(/(?<![\$])(\[[^\$\[\]]+\]|[\w\d\.]+)\s*\/\s*(\[[^\$\[\]]+\]|[\w\d\.]+)(?![\$])/g, (match, p1, p2) => {
      let num = p1.trim();
      let den = p2.trim();
      // Strip outer square brackets if present
      if (num.startsWith('[') && num.endsWith(']')) num = num.slice(1, -1);
      if (den.startsWith('[') && den.endsWith(']')) den = den.slice(1, -1);
      return `$ \\frac{${num}}{${den}} $`;
    });

    // 2. Exponents like x^2, (x+1)^2, a^b that aren't already preceded by $
    res = res.replace(/(?<![\$])(\b[a-zA-Z0-9]+\^\{?[a-zA-Z0-9]+\}?|\([^\$]+\)\^\{?[a-zA-Z0-9]+\}?)(?![\$])/g, (match) => {
      return `$${match}$`;
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
