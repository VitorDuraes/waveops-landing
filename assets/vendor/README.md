# assets/vendor

Runtime de terceiros usado pelos islands React da landing. **Não editar estes arquivos à mão.**
Para regenerar: `python _fetch_vendor.py` na raiz do repo.

| Arquivo | Pacote | Versão | Origem |
|---|---|---|---|
| `react.mjs` | react | 19.2.8 | esm.sh |
| `jsx-runtime.mjs` | react/jsx-runtime | 19.2.8 | esm.sh |
| `react-dom-client.mjs` | react-dom/client | 19.2.8 | esm.sh |
| `framer-motion.mjs` | framer-motion | 11.18.2 | esm.sh |
| `emotion-is-prop-valid.mjs` | @emotion/is-prop-valid | peer do framer-motion | esm.sh |
| `framer-shim.mjs` | nosso | 1.0 | escrito à mão |

Baixado em 09/09/2026 com `?bundle-deps&deps=react@19.2.8,react-dom@19.2.8&target=es2022`.

As duas flags são obrigatórias juntas. Sem `deps=`, o framer-motion resolve `react@^19.2.0`
sozinho e a página passa a carregar duas cópias do React, o que quebra os hooks.

Todos os caminhos absolutos do esm.sh foram reescritos para caminho relativo, então a pasta
funciona offline e a CSP continua `script-src 'self'`.

**Vendorizado é invisível para o Dependabot.** Revisar estas versões à mão a cada trimestre.
