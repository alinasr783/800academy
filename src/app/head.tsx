export default function Head() {
  return (
    <>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries" />
      <link
        href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@700;800&family=Inter:wght@400;500;600&display=swap"
        rel="stylesheet"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        rel="stylesheet"
      />
      <script
        id="tailwind-config"
        dangerouslySetInnerHTML={{
          __html: `tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            "colors": {
                "primary": "#002D62",
                "secondary": "#3E5E95",
                "accent": "#F59E0B",
                "surface": "#FFFFFF",
                "surface-variant": "#F4F3F8",
                "on-surface": "#1A1B1F",
                "on-surface-variant": "#475569",
                "outline": "#E2E8F0"
            },
            "borderRadius": {
                "DEFAULT": "0.25rem",
                "sm": "0.125rem",
                "md": "0.25rem",
                "lg": "0.5rem",
                "xl": "0.75rem",
                "2xl": "1rem",
                "3xl": "1.5rem"
            },
            "fontFamily": {
                "headline": ["Plus Jakarta Sans", "sans-serif"],
                "body": ["Manrope", "sans-serif"],
                "inter": ["Inter", "sans-serif"]
            },
            "boxShadow": {
                "premium": "0 10px 15px -3px rgba(0, 0, 0, 0.04), 0 4px 6px -2px rgba(0, 0, 0, 0.02), 0 20px 25px -5px rgba(0, 0, 0, 0.03)",
                "soft-xl": "0 20px 50px -12px rgba(0, 0, 0, 0.08)",
                "glow": "0 0 20px rgba(62, 94, 149, 0.15)"
            }
          },
        },
      }`,
        }}
      />
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24;
        }
        .nav-blur {
            backdrop-filter: blur(16px);
            background-color: rgba(250, 249, 254, 0.8);
        }
        .gradient-text {
            background: linear-gradient(135deg, #002D62 0%, #3E5E95 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .micro-interaction:hover {
            transform: translateY(-4px);
            transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
        }
        .section-curve {
            clip-path: ellipse(150% 100% at 50% 0%);
        }
        .btn-sharp { border-radius: 4px !important; }
    `,
        }}
      />
    </>
  );
}
