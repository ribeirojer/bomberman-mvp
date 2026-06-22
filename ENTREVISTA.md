# Decisões Técnicas

Documento complementar ao README — explica o raciocínio por trás das escolhas de arquitetura,
trade-offs considerados e possíveis próximos passos.

---

## 1. Engine puro (framework-agnostic)

**Decisão:** Separar completamente a lógica do jogo (`game/`) da camada de UI (`components/`).

**Por quê:**
- O engine não importa React, DOM, nem hooks. Toda função recebe estado e retorna novo estado.
- Isso permite testar a lógica isoladamente (basta chamar funções com objetos puros, sem montar componentes).
- Futuramente o mesmo engine pode rodar em um servidor WebSocket (Node.js, Deno, Bun) sem alteração — é só serializar `GameState` como JSON.
- Também permite trocar a UI (ex: migrar de Tailwind para Canvas, ou React Native) sem reescrever o jogo.

**Trade-off:** Toda atualização de estado gera um novo objeto (spread operators). Para um jogo com 2 jogadores e ~30 bombas no máximo, o custo de alocação é irrelevante. Para centenas de entidades seria necessário um ECS ou estruturas mutáveis com Immer.

---

## 2. Host-authority (sem servidor)

**Decisão:** Um dos dois clientes (o anfitrião) é o dono da verdade. Não há servidor de jogo dedicado.

**Por quê:**
- Elimina a necessidade de um backend de jogo (WebSocket server, colocation, scaling).
- Supabase Realtime já provê o canal de comunicação (Broadcast + Presence) sem custo adicional de infra.
- Para 2 jogadores, latência é aceitável — o convidado vê o estado com um frame de atraso (imperceptível a 60fps).

**Trade-off:** O convidado confia cegamente no estado recebido do anfitrião. Em um jogo competitivo isso seria inaceitável (host poderia trapacear). Para um MVP/demo/entrevista é adequado.

**Alternativa considerada:** Servidor autoritativo com validação de inputs. Seria o próximo passo natural (ver seção 6).

---

## 3. Supabase Realtime vs WebSockets puros

**Decisão:** Usar Supabase Realtime (Broadcast + Presence) em vez de um servidor WebSocket dedicado.

**Por quê:**
- Presence resolve automaticamente detecção de conexão/desconexão de jogadores — sem código额外.
- Broadcast tem exatamente a semântica necessária: enviar mensagem para todos no canal.
- O canal é isolado por sala (`room:ABCD`) — impossível vazar mensagens entre salas.
- Realtime é built-in no plano gratuito do Supabase, sem necessidade de deploy separado.

**Trade-off:** Supabase Realtime é abstração sobre WebSockets. Se o jogo crescesse para 4+ jogadores ou exigisse mensagens customizadas complexas, WebSockets puros (ex: `ws` no Node.js) dariam mais controle.

---

## 4. Por que Next.js App Router em vez de Vite/SPA puro?

**Decisão:** Next.js com App Router.

**Por quê:**
- O projeto foi bootstrapped pelo v0, que gera Next.js.
- App Router é o padrão moderno do Next.js (server components, streaming, layouts aninhados).
- Para um jogo isso é overkill — 99% do código é `"use client"`. Mas demonstra familiaridade com o ecossistema React/Next.js mais recente, o que é relevante para entrevistas.
- O deploy na Vercel é gratuito e imediato (merge no `main` → produção).

**Trade-off:** Poderia ser um Vite SPA com zero overhead de SSR. Mas perderia o deploy automático e a familiaridade do mercado com Next.js.

---

## 5. Tailwind v4 + shadcn/ui

**Decisão:** Tailwind v4 (sem config file, `@theme inline` no CSS) + shadcn/ui com `@base-ui/react`.

**Por quê:**
- Tailwind v4 elimina o `tailwind.config.js` — toda configuração vai no CSS via `@theme` e variáveis.
- shadcn/ui fornece componentes acessíveis e customizáveis — o botão, por exemplo, já vem com estados `focus-visible`, `aria-invalid`, `disabled`.
- `@base-ui/react` (sucessor do Radix) é a biblioteca de primitivos headless usada pelo shadcn/ui moderno.

**Trade-off:** Tailwind v4 é recente (lançado em 2025) — alguns plugins e tutoriais ainda referenciam v3. O ecossistema está em transição.

---

## 6. Movimento contínuo com grid discreto

**Decisão:** O jogador se move suavemente entre células (posição `x/y` interpolada), mas a colisão e ações (bomba, explosão) são resolvidas na célula inteira mais próxima (`position.row/col`).

**Por quê:**
- É o comportamento clássico de Bomberman: movimento fluido, grid lógico discreto.
- Simplifica colisão: basta checar se a célula alvo é `"floor"` e não tem bomba.
- Evita edge cases de física contínua (ex: dois jogadores se sobrepondo parcialmente).

**Implementação:** `movePlayer()` só aceita nova direção quando o jogador está alinhado (`isAligned()`) com a célula atual. `tickMovement()` avança a posição de render a cada frame com `dt * MOVE_SPEED`.

---

## 7. Reação em cadeia de bombas com BFS

**Decisão:** Usar uma fila (BFS) para processar detonações, em vez de recursão ou loops aninhados.

**Por quê:**
- Se uma bomba explode e atinge outra bomba, essa segunda deve explodir no mesmo tick. A fila garante que todas as bombas alcançadas sejam processadas.
- BFS é o algoritmo natural para propagação em grade.
- Evita recursão infinita (uma bomba não pode detonar a si mesma — usamos um `Set<string>` de bombas já explodidas).

---

## 8. Por que não usei estado global (Redux, Zustand, Context)?

**Decisão:** `useState` + `useRef` locais em `OnlineGame.tsx`. Sem estado global.

**Por quê:**
- O jogo tem um único estado — o `GameState`. Só um componente (`OnlineGame`) precisa dele.
- `useRef` mantém a versão mais recente do estado para o game loop (evita closures estagnadas no `requestAnimationFrame`).
- Não há múltiplos consumidores de estado que justifiquem Context ou store global.

**Trade-off:** Se houvesse múltiplos componentes precisando de partes diferentes do estado (ex: minimapa, HUD, painel de debug), Zustand ou Context fariam sentido. Para o escopo atual, `useState` + `useRef` é suficiente e mais simples.

---

## 9. Tipagem forte e tipos discriminados

**Decisão:** Usar union types discriminados para mensagens de rede e estado do lobby.

**Por quê:**
```typescript
// Exemplo: o tipo da mensagem determina quais campos existem
type BroadcastMessage = InputMessage | StateMessage

// O switch por msg.type faz o TypeScript narrowing automático
if (msg.type === "input") {
  // msg.action está disponível, msg.state não
}
```

Isso elimina checagens manuais de campos opcionais e torna o código à prova de erros de runtime — o compilador garante que todos os casos são tratados.

---

## 10. Barrel exports

**Decisão:** Cada diretório (`game/`, `hooks/`, `lib/`) tem um `index.ts` que reexporta a API pública.

**Por quê:**
- Quem importa não precisa saber qual arquivo interno contém cada símbolo:
  ```typescript
  // Antes: 3 imports
  import { createInitialState } from "@/game/gameEngine"
  import type { GameState } from "@/game/types"
  import type { BroadcastMessage } from "@/game/networkTypes"
  
  // Depois: 1 import
  import { createInitialState, type GameState, type BroadcastMessage } from "@/game"
  ```
- Define uma API pública explícita para cada módulo — o que é interno pode mudar sem quebrar consumidores.

---

## Próximos passos

### Curto prazo
- [ ] **Testes unitários no engine** — funções puras são triviais de testar. Cobrir `movePlayer`, `placeBomb`, `updateGame`, reação em cadeia.
- [ ] **Tratamento de reconexão** — se o convidado cair e voltar, hoje ele perde o jogo. Daria para restaurar o estado via broadcast.
- [ ] **Indicador de latência** — mostrar ping do convidado na UI.

### Médio prazo
- [ ] **Servidor autoritativo WebSocket** — portar o engine para um servidor Node.js/Deno que valida inputs dos dois jogadores. Elimina confiança cega no host.
- [ ] **3-4 jogadores** — o grid e os spawns já suportam (basta gerar mais posições). O modelo host-authority precisaria ser revisto (broadcast para N peers).
- [ ] **Power-ups** — itens que aparecem ao destruir tijolos (mais bombas, maior alcance, velocidade, chute de bomba).

### Longo prazo
- [ ] **Matchmaking** — fila de jogadores em vez de código de sala manual.
- [ ] **Replay / ghost** — gravar partidas como sequência de inputs e reproduzi-las.
- [ ] **Mobile** — adaptar controles para touch (joystick virtual + botão de bomba).

---

## Resumo para entrevista

O que este projeto demonstra:

| Competência | Onde está |
|-------------|-----------|
| TypeScript avançado | Union types discriminados, generics, barrel exports |
| Arquitetura desacoplada | Engine puro sem dependência de framework |
| Rede peer-to-peer | Host-authority com Supabase Realtime |
| Gerenciamento de estado | useRef + useState, sem libs externas |
| CSS moderno | Tailwind v4, animações keyframe, variáveis CSS |
| Código limpo | Funções puras, componentes pequenos, sem god objects |
| Tomada de decisão | Este documento |
