import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CustomerCareChat from "./CustomerCareChat";
const state = vi.hoisted(() => ({ user: { id: "user-a" } as {id:string}|null }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({user:state.user,loading:false}) }));
vi.mock("@/hooks/useRBAC", () => ({ useRBAC: () => ({roles:["user"],loading:false}) }));
vi.mock("@/integrations/supabase/client", () => ({supabase:{}}));
vi.mock("@/integrations/supabase/untyped", () => ({untypedDb:{from:()=>({select:()=>({eq:()=>({order:async()=>({data:[],error:null})})})})}}));
vi.mock("sonner", () => ({toast:{error:vi.fn(),success:vi.fn()}}));
describe("chat account boundary", () => {
 beforeEach(()=>{state.user={id:"user-a"};});
 it("discards unsent subject/message and open state across an in-place account switch", async()=>{
  const view=render(<MemoryRouter><CustomerCareChat/></MemoryRouter>);
  fireEvent.click(screen.getByRole("button",{name:"Chat with customer care"}));
  fireEvent.change(await screen.findByLabelText("Subject"),{target:{value:"Private A subject"}});
  fireEvent.change(screen.getByLabelText("Message"),{target:{value:"Private A draft"}});
  state.user={id:"user-b"};view.rerender(<MemoryRouter><CustomerCareChat/></MemoryRouter>);
  expect(screen.queryByDisplayValue("Private A draft")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"Chat with customer care"}));
  await waitFor(()=>expect(screen.getByLabelText("Subject")).toHaveValue(""));
  expect(screen.getByLabelText("Message")).toHaveValue("");
 });
});
