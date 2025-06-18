"use client";
import { Menu, Transition } from "@headlessui/react";
import { Fragment } from "react";

interface Props {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

export default function AppShell({ sidebar, children }: Props) {
  return (
    <div
      className="grid min-h-screen"
      style={{ gridTemplateColumns: "240px 1fr" }}>
      <aside className="border-r border-gray-200 bg-gray-50">{sidebar}</aside>
      <div className="relative">
        <header className="fixed left-[240px] right-0 top-0 z-10 h-16 border-b border-gray-200 bg-white shadow-sm">
          <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
            <div className="font-semibold text-xl">Easy CEP</div>
            <nav className="flex-1 justify-center hidden md:flex gap-6">
              <a
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
                href="#">
                Workflow
              </a>
            </nav>
            <Menu as="div" className="relative">
              <Menu.Button className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-gray-600">
                U
              </Menu.Button>
              <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95">
                <Menu.Items className="absolute right-0 mt-2 w-40 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none">
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        className={`w-full px-3 py-1.5 text-left text-sm ${active ? "bg-gray-100" : ""}`}>
                        Sign out
                      </button>
                    )}
                  </Menu.Item>
                </Menu.Items>
              </Transition>
            </Menu>
          </div>
        </header>
        <main className="pt-16 p-8 bg-white min-h-screen">{children}</main>
      </div>
    </div>
  );
}
