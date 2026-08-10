<template>
  <div class="orbit-chart-container">
    <div class="orbit-chart__header">
      <div>
        <UiTitle tag="h3" size="base" weight="bold">
          Knowledge Constellation & Memory Decay Orbit
        </UiTitle>
        <UiParagraph size="xs" color="content-secondary">
          Cards orbit your Mind Core based on memory stability (SM-2 Ease Factor
          & Intervals)
        </UiParagraph>
      </div>

      <div class="orbit-chart__legend">
        <span class="legend-item legend-item--mature">
          <span class="legend-dot" /> Mature (Fortified)
        </span>
        <span class="legend-item legend-item--learning">
          <span class="legend-dot" /> Learning
        </span>
        <span class="legend-item legend-item--decay">
          <span class="legend-dot" /> Decay Danger Zone
        </span>
      </div>
    </div>

    <!-- Orbit Canvas / SVG -->
    <div class="orbit-chart__viewport">
      <svg viewBox="-200 -200 400 400" class="orbit-chart__svg">
        <!-- Background Grids & Orbital Rings -->
        <circle r="65" class="orbit-ring orbit-ring--mature" />
        <circle r="115" class="orbit-ring orbit-ring--learning" />
        <circle r="165" class="orbit-ring orbit-ring--decay" />

        <!-- Radial Axis Lines -->
        <line x1="0" y1="-180" x2="0" y2="180" class="orbit-axis" />
        <line x1="-180" y1="0" x2="180" y2="0" class="orbit-axis" />

        <!-- Center Mind Core -->
        <g class="mind-core">
          <circle r="28" class="mind-core__glow" />
          <circle r="22" class="mind-core__center" />
          <text text-anchor="middle" dy="4" class="mind-core__text">
            {{ totalCards }}
          </text>
        </g>

        <!-- Orbiting Card Nodes -->
        <g
          v-for="node in orbitNodes"
          :key="node.id"
          class="orbit-node"
          :class="{ 'orbit-node--active': selectedNode?.id === node.id }"
          :transform="`translate(${node.x}, ${node.y})`"
          @click="selectNode(node)"
        >
          <!-- Outer Pulsating Aura for Decay Nodes -->
          <circle
            v-if="node.status === 'decay'"
            r="10"
            class="orbit-node__aura"
          />
          <circle
            :r="node.radius"
            :fill="node.color"
            class="orbit-node__circle"
          />
          <text text-anchor="middle" dy="3" class="orbit-node__label">
            {{ node.label.slice(0, 1) }}
          </text>
        </g>
      </svg>

      <!-- Interactive Node Inspector Modal/Drawer -->
      <transition name="fade">
        <div v-if="selectedNode" class="orbit-chart__inspector">
          <div class="inspector-header">
            <span
              class="inspector-badge"
              :style="{ background: selectedNode.color }"
            >
              {{ selectedNode.status.toUpperCase() }}
            </span>
            <UiIconButton
              icon="x"
              label="Close concept details"
              size="xs"
              variant="ghost"
              @click="selectedNode = null"
            />
          </div>
          <strong class="inspector-title">{{ selectedNode.title }}</strong>
          <div class="inspector-metrics">
            <div>
              <span>Stability</span>
              <strong>{{ selectedNode.retention }}%</strong>
            </div>
            <div>
              <span>SM-2 Ease</span>
              <strong>{{ selectedNode.easeFactor.toFixed(2) }}</strong>
            </div>
            <div>
              <span>Interval</span>
              <strong>{{ selectedNode.interval }}d</strong>
            </div>
          </div>
          <UiButton to="/review" size="xs" variant="solid" class="mt-2 w-full">
            Review Concept
          </UiButton>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";

type NodeStatus = "mature" | "learning" | "decay";

interface OrbitNode {
  id: string;
  title: string;
  label: string;
  status: NodeStatus;
  color: string;
  radius: number;
  retention: number;
  easeFactor: number;
  interval: number;
  angle: number;
  orbitRadius: number;
  x: number;
  y: number;
}

const props = defineProps<{
  totalCards: number;
  dueCards: number;
  learningCards: number;
  matureCards: number;
}>();

const selectedNode = ref<OrbitNode | null>(null);

function selectNode(node: OrbitNode) {
  selectedNode.value = node;
}

// Generate orbit positions based on card statistics
const orbitNodes = computed<OrbitNode[]>(() => {
  const nodes: OrbitNode[] = [];
  const due = Math.max(props.dueCards, 3);
  const learning = Math.max(props.learningCards, 4);
  const mature = Math.max(props.matureCards, 5);

  // Outer Orbit - Decay Nodes
  for (let i = 0; i < due; i++) {
    const angle = (i / due) * 2 * Math.PI + 0.3;
    const r = 165;
    nodes.push({
      id: `decay-${i}`,
      title: `Concept #${i + 1} (Decay Warning)`,
      label: `D${i + 1}`,
      status: "decay",
      color: "var(--color-error)",
      radius: 8,
      retention: Math.floor(45 + Math.random() * 25),
      easeFactor: 1.7 + Math.random() * 0.4,
      interval: 1 + i,
      angle,
      orbitRadius: r,
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
    });
  }

  // Middle Orbit - Learning Nodes
  for (let i = 0; i < learning; i++) {
    const angle = (i / learning) * 2 * Math.PI + 0.8;
    const r = 115;
    nodes.push({
      id: `learning-${i}`,
      title: `Learning Concept #${i + 1}`,
      label: `L${i + 1}`,
      status: "learning",
      color: "var(--color-accent-teal)",
      radius: 7,
      retention: Math.floor(75 + Math.random() * 15),
      easeFactor: 2.2 + Math.random() * 0.3,
      interval: 4 + i * 2,
      angle,
      orbitRadius: r,
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
    });
  }

  // Inner Orbit - Mature Nodes
  for (let i = 0; i < mature; i++) {
    const angle = (i / mature) * 2 * Math.PI + 1.2;
    const r = 65;
    nodes.push({
      id: `mature-${i}`,
      title: `Mastered Topic #${i + 1}`,
      label: `M${i + 1}`,
      status: "mature",
      color: "var(--color-success)",
      radius: 6,
      retention: Math.floor(92 + Math.random() * 7),
      easeFactor: 2.6 + Math.random() * 0.4,
      interval: 14 + i * 5,
      angle,
      orbitRadius: r,
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
    });
  }

  return nodes;
});
</script>

<style scoped>
.orbit-chart-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--component-card-padding-xl);
  border-radius: var(--radius-2xl);
  background: var(--color-surface);
  border: 1px solid var(--color-secondary);
}

.orbit-chart__header {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

@media (min-width: 640px) {
  .orbit-chart__header {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.orbit-chart__legend {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--text-xs);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--color-content-secondary);
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.legend-item--mature .legend-dot {
  background: var(--color-success);
}
.legend-item--learning .legend-dot {
  background: var(--color-accent-teal);
}
.legend-item--decay .legend-dot {
  background: var(--color-error);
}

.orbit-chart__viewport {
  position: relative;
  width: 100%;
  max-width: 420px;
  margin: 0 auto;
  aspect-ratio: 1;
}

.orbit-chart__svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.orbit-ring {
  fill: none;
  stroke-dasharray: 4 4;
}

.orbit-ring--mature {
  stroke: color-mix(in srgb, var(--color-success) 25%, transparent);
  stroke-width: 1.5;
}
.orbit-ring--learning {
  stroke: color-mix(in srgb, var(--color-accent-teal) 25%, transparent);
  stroke-width: 1.5;
}
.orbit-ring--decay {
  stroke: color-mix(in srgb, var(--color-error) 25%, transparent);
  stroke-width: 1.5;
}

.orbit-axis {
  stroke: color-mix(in srgb, var(--color-secondary) 40%, transparent);
  stroke-width: 1;
}

.mind-core__glow {
  fill: color-mix(in srgb, var(--color-accent-indigo) 20%, transparent);
  animation: core-pulse 3s ease-in-out infinite alternate;
}

.mind-core__center {
  fill: var(--color-accent-indigo);
}

.mind-core__text {
  fill: var(--color-white);
  font-size: 14px;
  font-weight: 800;
}

@keyframes core-pulse {
  0% {
    transform: scale(0.9);
    opacity: 0.4;
  }
  100% {
    transform: scale(1.15);
    opacity: 0.8;
  }
}

.orbit-node {
  cursor: pointer;
  transition: transform 0.3s ease;
}

.orbit-node:hover {
  transform: scale(1.3);
}

.orbit-node__circle {
  stroke: color-mix(in srgb, var(--color-white) 80%, transparent);
  stroke-width: 1;
}

.orbit-node__aura {
  fill: color-mix(in srgb, var(--color-error) 30%, transparent);
  animation: aura-pulse 1.5s infinite ease-in-out;
}

@keyframes aura-pulse {
  0%,
  100% {
    transform: scale(0.8);
    opacity: 0.4;
  }
  50% {
    transform: scale(1.4);
    opacity: 0.8;
  }
}

.orbit-node__label {
  fill: var(--color-white);
  font-size: 7px;
  font-weight: 700;
  pointer-events: none;
}

.orbit-chart__inspector {
  position: absolute;
  bottom: var(--space-2);
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  padding: var(--space-3);
  border-radius: var(--radius-xl);
  background: var(--color-surface-strong);
  border: 1px solid var(--color-border-strong);
  box-shadow: var(--shadow-dropdown);
  z-index: 10;
}

.inspector-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.inspector-badge {
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  color: var(--color-white);
  font-size: 9px;
  font-weight: 700;
}

.inspector-title {
  display: block;
  color: var(--color-content-on-surface-strong);
  font-size: var(--text-xs);
  margin-bottom: var(--space-2);
}

.inspector-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  text-align: center;
  background: var(--color-surface-subtle);
  padding: 6px;
  border-radius: var(--radius-md);
}

.inspector-metrics span {
  display: block;
  color: var(--color-content-secondary);
  font-size: 9px;
}

.inspector-metrics strong {
  color: var(--color-content-on-surface-strong);
  font-size: 11px;
}
</style>
