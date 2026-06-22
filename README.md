# Bomberman MVP

Clone multiplayer de Bomberman em tempo real — construído para demonstrar desenvolvimento full-stack moderno com TypeScript: engine de jogo puro, rede host-authority e arquitetura de componentes limpa.

## Stack

- **Next.js 16** (App Router) + **React 19**
- **TypeScript 5.7** — tipagem forte em todo o projeto
- **Tailwind CSS v4** — estilização utilitária com animações CSS customizadas
- **Supabase Realtime** — Broadcast + Presence para multiplayer estilo WebSocket
- **shadcn/ui** (`@base-ui/react`) — primitivos de UI acessíveis

## Arquitetura

```
game/          Engine puro — sem React, sem DOM. Retorna novos objetos de estado.
               Projetado para ser portado para um servidor WebSocket futuramente.

components/    Camada de UI React. Lê estado, renderiza pixels, captura input.

hooks/         Custom hooks — gerenciamento de canal Supabase Realtime,
               cálculo responsivo de tamanho de célula.

lib/           Utilitários — singleton do cliente Supabase, CRUD de salas, cn().
```

### Modelo de rede (host-authority)

```
Convidado (Player 2)         Anfitrião (Player 1)
     │                              │
     ├── msg de input ────────────►│
     │                              ├─ executa gameEngine.ts
     │                              ├─ tickMovement() / updateGame()
     │                              ├─ movePlayer() / placeBomb()
     │                              │
     │◄── msg de estado ───────────┤
     │                              │
     └─ renderiza estado recebido   └─ renderiza próprio estado
```

- Apenas o **anfitrião** executa o engine — zero lógica no servidor.
- O **convidado** envia intenções de teclas via Supabase Broadcast; o anfitrião aplica e transmite o `GameState` completo a cada frame.
- Ambos sincronizam via Supabase **Presence** (detecta automaticamente entrada/saída).

### Destaques do engine

- Todas as funções são **puras**: `movePlayer(state, playerId, direction, now)` → novo estado. Sem mutações, sem singletons.
- **Movimento contínuo** com colisão baseada em grid — jogadores deslizam suavemente entre células mas só se comprometem ao próximo tile quando alinhados.
- **Reação em cadeia de bombas** — bombas ao detonar acionam bombas vizinhas, usando fila BFS para sequenciamento correto.
- Constantes configuráveis: tempo de pavio (3s), alcance da explosão (2 tiles), duração da explosão (550ms), velocidade de movimento.

## Como rodar

```bash
npm install
npm run dev                # http://localhost:3000
```

### Verificação de tipos

```bash
npx tsc --noEmit           # execute sempre após alterações (build ignora erros de TS)
```

### Variáveis de ambiente

Crie um arquivo `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
```

O projeto Supabase precisa de:
- Tabela `bomberman_rooms` (`room_code` text PK, `status` text, `updated_at` timestamptz)
- Realtime habilitado na tabela `bomberman_rooms`

## Estrutura do projeto

```
app/                  Layout, página, globals.css
components/
  Lobby.tsx           UI de criação/entrada em salas
  OnlineGame.tsx      Loop de jogo multiplayer + lógica host/convidado
  Board.tsx           Renderizador do grid, bombas, jogadores, explosões
  Player.tsx          Token do jogador com direção e animação de morte
  Bomb.tsx            Token de bomba com animação de pulsação do pavio
  PlayerStatusBar.tsx Nome do jogador + status vivo/morto
  WaitingScreen.tsx   Tela de espera pré-jogo
  ConnectionStatus.tsx Indicador de conexão
  GameOverBanner.tsx  Anúncio de vitória/empate
  ErrorBoundary.tsx   Barreira de erro do React
  ui/button.tsx       Botão shadcn/ui
game/
  types.ts            Interfaces, constantes (COLS, ROWS, BOMB_FUSE_MS…)
  gameEngine.ts       Lógica pura do jogo (movimento, bombas, explosões, colisão)
  networkTypes.ts     Tipos das mensagens de Broadcast
  index.ts            Barrel export
hooks/
  useSupabaseRealtime.ts  Canal Supabase + Presence + Broadcast
  useCellSize.ts          Tamanho responsivo de célula
  index.ts                Barrel export
lib/
  utils.ts            cn() — clsx + tailwind-merge
  supabase.ts         Singleton do cliente Supabase
  supabaseActions.ts  Operações CRUD de salas
  index.ts            Barrel export
```
