import React, { useState } from "react";
import {
  ColorData,
  Language,
  PaintProject,
  PaletteCategory,
  PartCanvas,
} from "../types";
import { colorsToFloatingNodes } from "../utils/projectStore";
import { inferStepsFromNodes } from "../utils/projectSharing";
import { XIcon, FolderPlusIcon, PlusIcon, CheckIcon } from "@phosphor-icons/react";
import { ResponsiveSheet } from "./ResponsiveSheet";

interface SaveToProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string | null;
  colors: ColorData[];
  projects: PaintProject[];
  categories: PaletteCategory[];
  onSaveToProject: (updatedOrNewProject: PaintProject, isNew: boolean) => void;
  onCreateCategory?: (name: string) => PaletteCategory;
  lang: Language;
}

export const SaveToProjectModal: React.FC<SaveToProjectModalProps> = ({
  isOpen,
  onClose,
  imageSrc,
  colors,
  projects,
  categories,
  onSaveToProject,
  onCreateCategory,
}) => {
  const [mode, setMode] = useState<"existing" | "new">(
    projects.length > 0 ? "existing" : "new"
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    projects[0]?.id || ""
  );
  const [newProjectTitle, setNewProjectTitle] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    categories[0]?.id || null
  );
  const [partName, setPartName] = useState<string>("零件 1 (外甲/主体)");
  const [newCatName, setNewCatName] = useState<string>("");
  const [showNewCatInput, setShowNewCatInput] = useState<boolean>(false);

  const nodes = colorsToFloatingNodes(colors);

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageSrc) return;

    const now = Date.now();
    const newPart: PartCanvas = {
      id: `part-${now}`,
      partName: partName.trim() || `零件 ${now.toString().slice(-3)}`,
      sourceImageDataUrl: imageSrc,
      nodes,
      steps: inferStepsFromNodes(nodes),
      createdAt: now,
    };

    if (mode === "existing" && selectedProjectId) {
      const target = projects.find((p) => p.id === selectedProjectId);
      if (target) {
        const updated: PaintProject = {
          ...target,
          coverImageDataUrl: target.coverImageDataUrl || imageSrc,
          updatedAt: now,
          parts: [...target.parts, newPart],
        };
        onSaveToProject(updated, false);
        onClose();
        return;
      }
    }

    const created: PaintProject = {
      id: `proj-${now}`,
      title: newProjectTitle.trim() || `未命名涂装工程 ${projects.length + 1}`,
      coverImageDataUrl: imageSrc,
      createdAt: now,
      updatedAt: now,
      categoryId: selectedCategoryId,
      parts: [newPart],
    };
    onSaveToProject(created, true);
    onClose();
  };

  const handleAddCat = () => {
    if (!newCatName.trim() || !onCreateCategory) return;
    const cat = onCreateCategory(newCatName.trim());
    setSelectedCategoryId(cat.id);
    setNewCatName("");
    setShowNewCatInput(false);
  };

  return (
    <ResponsiveSheet
      open={isOpen}
      onClose={onClose}
      desktopPlacement="center"
      desktopWidth={440}
      icon={
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <FolderPlusIcon className="h-4 w-4" />
        </span>
      }
      title={
        <span className="flex flex-col">
          <span>保存至涂装项目</span>
          <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
            含无损原图与 {nodes.length} 个已指派悬浮色卡节点
          </span>
        </span>
      }
    >
        <form onSubmit={handleConfirm} className="space-y-4">
          {/* Mode Switcher */}
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800 p-1">
            <button
              type="button"
              disabled={projects.length === 0}
              onClick={() => setMode("existing")}
              className={`rounded-xl py-2 text-xs font-extrabold transition ${
                mode === "existing"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 disabled:opacity-40"
              }`}
            >
              存入已有项目 ({projects.length})
            </button>
            <button
              type="button"
              onClick={() => setMode("new")}
              className={`rounded-xl py-2 text-xs font-extrabold transition ${
                mode === "new"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500"
              }`}
            >
              + 新建涂装工程
            </button>
          </div>

          {mode === "existing" && projects.length > 0 ? (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                选择目标工程文件夹
              </label>
              <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                {projects.map((proj) => {
                  const active = proj.id === selectedProjectId;
                  return (
                    <button
                      key={proj.id}
                      type="button"
                      onClick={() => setSelectedProjectId(proj.id)}
                      className={`w-full flex items-center justify-between gap-3 rounded-2xl border p-2.5 text-left transition ${
                        active
                          ? "border-coral bg-coral/10 ring-1 ring-coral/30"
                          : "border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {proj.coverImageDataUrl ? (
                          <img
                            src={proj.coverImageDataUrl}
                            alt=""
                            className="h-10 w-10 rounded-xl object-cover border border-black/10 shrink-0"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-xl bg-slate-200 dark:bg-slate-800 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="truncate text-xs font-extrabold text-slate-900 dark:text-white">
                            {proj.title}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            含 {proj.parts.length} 个零件色卡图
                          </div>
                        </div>
                      </div>
                      {active && <CheckIcon className="h-4 w-4 text-coral shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  新建工程名称
                </label>
                <input
                  type="text"
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  placeholder="例如：卡牛 Ver.Ka 涂装企划"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:border-coral focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    所属分类标签
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowNewCatInput(!showNewCatInput)}
                    className="text-[11px] font-bold text-coral hover:underline"
                  >
                    + 新建分类
                  </button>
                </div>

                {showNewCatInput && (
                  <div className="flex items-center gap-2 pb-1">
                    <input
                      type="text"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      placeholder="输入新分类名称"
                      className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold"
                    />
                    <button
                      type="button"
                      onClick={handleAddCat}
                      className="rounded-xl bg-coral px-3 py-1.5 text-xs font-bold text-white"
                    >
                      添加
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryId(null)}
                    className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                      selectedCategoryId === null
                        ? "bg-coral text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    未分类
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                        selectedCategoryId === cat.id
                          ? "bg-coral text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Part Canvas Name */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
              当前零件/分件名称
            </label>
            <input
              type="text"
              value={partName}
              onChange={(e) => setPartName(e.target.value)}
              placeholder="例如：头部与天线 / 胸部主外甲 / 浮游炮"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:border-coral focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={!imageSrc}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-accent hover:bg-accent-hover py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-40 transition"
          >
            <PlusIcon className="h-4 w-4" />
            <span>保存零件色卡至涂装库</span>
          </button>
        </form>
    </ResponsiveSheet>
  );
};
