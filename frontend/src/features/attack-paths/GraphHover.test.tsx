import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ReactFlow, ReactFlowProvider } from "@xyflow/react";
import { useMemo } from "react";
import sample from "../landing/sample.json";
import { buildFlow, edgeTypes, nodeTypes } from "./graphKit";
import { useGraphHover } from "./GraphHover";
import type { AttackPath, GraphData, ResourceRow } from "../../lib/types";

const g = sample.graph as unknown as GraphData;
const rows = sample.resources as unknown as ResourceRow[];
const paths = sample.paths as unknown as AttackPath[];

function Harness() {
  const flow = useMemo(
    () => buildFlow({ g, resources: rows, all: paths, filtered: paths, selected: null, hood: null, scope: null, choke: new Map(), dir: "LR", showAll: true, mode: "all" } as any),
    [],
  );
  const hover = useGraphHover({ g, resources: rows, paths });
  return (
    <div style={{ width: 900, height: 600 }}>
      {hover.tip}
      <ReactFlow {...hover.bind} nodes={flow.nodes} edges={flow.edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} nodesConnectable={false} />
    </div>
  );
}
const mount = () => render(<ReactFlowProvider><Harness /></ReactFlowProvider>);

describe("graph hover", () => {
  it("renders nodes and edges", async () => {
    const { container } = mount();
    await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
    console.log("nodes", container.querySelectorAll(".react-flow__node").length, "edges", container.querySelectorAll(".react-flow__edge").length);
    expect(container.querySelectorAll(".react-flow__node").length).toBeGreaterThan(5);
  });
  it("keeps the tooltip while the mouse moves over a node (real hovering sends constant move events)", async () => {
    const { container } = mount();
    await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
    const node = container.querySelector(".react-flow__node") as HTMLElement;
    fireEvent.mouseEnter(node, { clientX: 100, clientY: 100 });
    expect(screen.queryByRole("tooltip")).not.toBeNull();
    for (let i = 0; i < 5; i++) {
      fireEvent.mouseMove(node, { clientX: 100 + i, clientY: 100 });
      fireEvent.pointerMove(node, { clientX: 100 + i, clientY: 100 }); // bubbles up to the pane
    }
    expect(screen.queryByRole("tooltip")).not.toBeNull();
  });
  it("clears the highlight when the mouse is over empty canvas", async () => {
    const { container } = mount();
    await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
    const node = container.querySelector(".react-flow__node") as HTMLElement;
    fireEvent.mouseEnter(node, { clientX: 100, clientY: 100 });
    expect(screen.queryByRole("tooltip")).not.toBeNull();
    fireEvent.pointerMove(container.querySelector(".react-flow__pane") as HTMLElement);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
  it("shows a tooltip when hovering a node and hides it on leave", async () => {
    const { container } = mount();
    await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
    const node = container.querySelector(".react-flow__node") as HTMLElement;
    fireEvent.mouseEnter(node, { clientX: 100, clientY: 100 });
    expect(screen.queryByRole("tooltip")).not.toBeNull();
    fireEvent.mouseLeave(node);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
  it("never removes or re-creates any line while hovering (the bug: lines vanished)", async () => {
    const { container } = mount();
    await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
    const edgeEls = () => [...container.querySelectorAll<HTMLElement>(".react-flow__edge")];
    const nodeEls = () => [...container.querySelectorAll<HTMLElement>(".react-flow__node")];
    const edges0 = edgeEls(), nodes0 = nodeEls();
    expect(edges0.length).toBeGreaterThan(5);
    // hover a node, then an edge, with realistic movement in between
    fireEvent.mouseEnter(nodes0[0], { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(nodes0[0]);
    expect(edgeEls().length).toBe(edges0.length); // immediately, not just after a moment
    expect(edgeEls().every((e, i) => e === edges0[i])).toBe(true); // the very same DOM elements: nothing was re-created
    expect(nodeEls().every((n, i) => n === nodes0[i])).toBe(true);
    fireEvent.mouseLeave(nodes0[0]);
    fireEvent.mouseEnter(edges0[0], { clientX: 120, clientY: 100 });
    fireEvent.pointerMove(edges0[0]);
    expect(edgeEls().length).toBe(edges0.length);
    expect(edgeEls().every((e, i) => e === edges0[i])).toBe(true);
    fireEvent.mouseLeave(edges0[0]);
    expect(edgeEls().length).toBe(edges0.length);
  });
  it("highlights by scoped CSS that softens (never hides) the rest, and removes it on leave", async () => {
    const { container } = mount();
    await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
    const edge = container.querySelector(".react-flow__edge") as HTMLElement;
    const rule = () => [...document.querySelectorAll("style")].map((s) => s.textContent ?? "").find((c) => c.includes(".react-flow__edge")) ?? "";
    expect(rule()).toBe("");
    fireEvent.mouseEnter(edge, { clientX: 100, clientY: 100 });
    const css = rule();
    const id = edge.getAttribute("data-id");
    expect(id).toBeTruthy(); // the CSS targets elements by data-id, so React Flow must expose it
    expect(css).toContain(`[data-id=${JSON.stringify(id)}]`);
    expect(container.querySelector(".react-flow__node")!.getAttribute("data-id")).toBeTruthy();
    // the generated selectors really match the graph: the hovered edge is excluded from the "soften" rule, others are included
    const soften = css.match(/\.(hl\w+) \.react-flow__edge:not\(([^)]*)\)/)!;
    expect(container.querySelectorAll(`.react-flow__edge:not(${soften[2]})`).length).toBe(container.querySelectorAll(".react-flow__edge").length - 1);
    expect(css).toContain("opacity: 0.6"); // unrelated nodes are softened
    expect(css).toContain("opacity: 0.5"); // unrelated lines are softened
    expect(css).not.toMatch(/opacity:\s*0(\.0\d*)?\s*[;}]/); // nothing is made (nearly) invisible
    expect(css).toContain("stroke-width: 3.4px"); // the hovered line is emphasised
    expect(container.querySelector(".react-flow")!.className).toMatch(/hl/); // scoped to this graph
    fireEvent.mouseLeave(edge);
    expect(rule()).toBe("");
    expect(container.querySelector(".react-flow")!.className).not.toMatch(/hl/);
  });
});
