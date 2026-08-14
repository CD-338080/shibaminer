'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { useGameStore } from '@/utils/game-mechanics';
import { capitalizeFirstLetter, formatNumber, triggerHapticFeedback } from '@/utils/ui';
import { imageMap } from '@/images';
import Time from '@/icons/Time';
import ShibaCoin from '@/icons/ShibaCoin';
import TaskPopup from './popups/TaskPopup';
import { Task } from '@/utils/types';

const TaskSkeleton = () => (
  <div className="space-y-8 animate-pulse">
    {[...Array(3)].map((_, categoryIndex) => (
      <div key={categoryIndex}>
        <div className="h-3 w-28 mb-4 bg-[rgba(255,107,26,0.15)]" />
        <div className="space-y-2">
          {[...Array(3)].map((_, taskIndex) => (
            <div key={taskIndex} className="earn-row">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 bg-[rgba(244,235,227,0.08)] shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-3 bg-[rgba(244,235,227,0.1)] w-32" />
                  <div className="h-2.5 bg-[rgba(255,107,26,0.12)] w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

const useFetchTasks = (userTelegramInitData: string) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await fetch(
          `/api/tasks?initData=${encodeURIComponent(userTelegramInitData)}`
        );
        if (!response.ok) throw new Error('Failed to fetch tasks');
        const data = await response.json();
        setTasks(data.tasks || []);
      } catch (error) {
        console.error('Error fetching tasks:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (userTelegramInitData) fetchTasks();
    else setIsLoading(false);
  }, [userTelegramInitData]);

  return { tasks, setTasks, isLoading };
};

export default function Earn() {
  const { userTelegramInitData } = useGameStore();
  const { tasks, setTasks, isLoading } = useFetchTasks(userTelegramInitData);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const handleTaskSelection = useCallback((task: Task) => {
    if (!task.isCompleted) {
      triggerHapticFeedback(window);
      setSelectedTask(task);
    }
  }, []);

  const handleTaskUpdate = useCallback(
    (updatedTask: Task) => {
      setTasks((prevTasks) =>
        prevTasks.map((t) => (t.id === updatedTask.id ? updatedTask : t))
      );
    },
    [setTasks]
  );

  const groupedTasks = useMemo(() => {
    return tasks.reduce(
      (acc, task) => {
        if (!acc[task.category]) acc[task.category] = [];
        acc[task.category].push(task);
        return acc;
      },
      {} as Record<string, Task[]>
    );
  }, [tasks]);

  const completedCount = useMemo(
    () => tasks.filter((t) => t.isCompleted).length,
    [tasks]
  );
  const totalReward = useMemo(
    () => tasks.reduce((sum, t) => sum + (t.isCompleted ? 0 : t.points), 0),
    [tasks]
  );

  return (
    <div className="earn-root flex justify-center min-h-screen">
      <div className="w-full max-w-xl h-[100dvh] max-h-[100dvh] flex flex-col text-[#f4ebe3] relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 earn-bg" />
        <div className="pointer-events-none absolute inset-0 earn-grid" />

        <div className="relative z-10 flex-1 min-h-0 overflow-y-auto overscroll-y-contain pb-28 px-4 earn-scroll">
          <header className="mt-4 earn-hero">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="earn-eyebrow">Shiba Miner · Quests</p>
                <h1 className="earn-title">
                  EARN
                  <span>SHIB</span>
                </h1>
                <p className="earn-sub">
                  Clear quests, stack SHIB. Tap a row to start — rewards land in your vault.
                </p>
              </div>
              <div className="earn-token">
                <ShibaCoin size={56} />
              </div>
            </div>

            <div className="earn-stats mt-4">
              <div className="earn-stat">
                <span className="earn-meta">done</span>
                <span className="earn-stat-val">
                  {completedCount}
                  <em>/{tasks.length || '—'}</em>
                </span>
              </div>
              <div className="earn-stat">
                <span className="earn-meta">open haul</span>
                <span className="earn-stat-val accent">
                  +{formatNumber(totalReward)}
                  <em>SHIB</em>
                </span>
              </div>
            </div>
          </header>

          <div className="mt-5">
            {isLoading ? (
              <TaskSkeleton />
            ) : tasks.length === 0 ? (
              <div className="earn-empty">
                <p className="earn-meta accent">no quests</p>
                <p className="text-sm font-semibold text-[#9a8f86] mt-2">
                  Check back soon — new SHIB drops land here.
                </p>
              </div>
            ) : (
              Object.entries(groupedTasks).map(([category, categoryTasks]) => (
                <section key={category} className="mb-6">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h2 className="earn-cat">{capitalizeFirstLetter(category)}</h2>
                    <span className="earn-meta">
                      {categoryTasks.filter((t) => t.isCompleted).length}/{categoryTasks.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {categoryTasks.map((task) => {
                      const done = !!task.isCompleted;
                      const pending = !done && !!task.taskStartTimestamp;
                      return (
                        <button
                          key={task.id}
                          type="button"
                          className={`earn-row w-full text-left ${done ? 'is-done' : ''} ${
                            pending ? 'is-pending' : ''
                          }`}
                          onClick={() => handleTaskSelection(task)}
                          disabled={done}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="earn-thumb">
                              {imageMap[task.image] ? (
                                <Image
                                  src={imageMap[task.image]}
                                  alt=""
                                  width={40}
                                  height={40}
                                  className="object-cover w-full h-full"
                                />
                              ) : (
                                <ShibaCoin size={40} />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="earn-row-title truncate">{task.title}</p>
                              <div className="flex items-center gap-1.5 mt-1">
                                <ShibaCoin size={16} />
                                <span className="earn-reward">+{formatNumber(task.points)} SHIB</span>
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 ml-2">
                            {done ? (
                              <span className="earn-badge is-ok" aria-label="Completed">
                                ✓
                              </span>
                            ) : pending ? (
                              <span className="earn-badge is-wait" aria-label="In progress">
                                <Time />
                              </span>
                            ) : (
                              <span className="earn-badge is-go">GO</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))
            )}
          </div>
        </div>
      </div>

      {selectedTask && (
        <TaskPopup
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleTaskUpdate}
        />
      )}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=Syne:wght@600;700;800&display=swap');

        .earn-root {
          --ink: #0c0c0e;
          --paper: #f4ebe3;
          --ember: #ff6b1a;
          --mute: #9a8f86;
          font-family: 'Syne', system-ui, sans-serif;
          background: var(--ink);
          color: var(--paper);
        }
        .earn-bg {
          background:
            radial-gradient(ellipse 80% 50% at 85% -8%, rgba(255, 107, 26, 0.26), transparent 55%),
            radial-gradient(ellipse 60% 40% at 0% 90%, rgba(255, 107, 26, 0.1), transparent 50%),
            linear-gradient(165deg, #141210 0%, #0c0c0e 48%, #16120f 100%);
        }
        .earn-grid {
          opacity: 0.15;
          background-image:
            linear-gradient(rgba(244, 235, 227, 0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(244, 235, 227, 0.06) 1px, transparent 1px);
          background-size: 28px 28px;
          mask-image: linear-gradient(180deg, #000 0%, transparent 88%);
        }
        .earn-scroll {
          -webkit-overflow-scrolling: touch;
          touch-action: pan-y;
        }
        .earn-hero {
          padding: 16px;
          border: 1px solid rgba(255, 107, 26, 0.28);
          background: rgba(20, 18, 16, 0.72);
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3);
        }
        .earn-eyebrow {
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.26em;
          text-transform: uppercase;
          color: var(--ember);
        }
        .earn-title {
          margin-top: 6px;
          font-size: clamp(2.1rem, 10vw, 2.75rem);
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 0.92;
          text-transform: uppercase;
        }
        .earn-title span {
          display: block;
          color: transparent;
          -webkit-text-stroke: 1.4px rgba(244, 235, 227, 0.85);
        }
        .earn-sub {
          margin-top: 10px;
          max-width: 18rem;
          font-size: 13px;
          font-weight: 600;
          line-height: 1.45;
          color: var(--mute);
        }
        .earn-token {
          filter: drop-shadow(0 0 18px rgba(255, 107, 26, 0.4));
          flex-shrink: 0;
        }
        .earn-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          padding-top: 14px;
          border-top: 1px solid rgba(255, 107, 26, 0.18);
        }
        .earn-stat {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .earn-meta {
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--mute);
        }
        .earn-meta.accent {
          color: var(--ember);
        }
        .earn-stat-val {
          font-size: 1.35rem;
          font-weight: 800;
          letter-spacing: -0.03em;
          font-variant-numeric: tabular-nums;
          line-height: 1;
        }
        .earn-stat-val.accent {
          color: var(--ember);
        }
        .earn-stat-val em {
          font-style: normal;
          margin-left: 4px;
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: var(--mute);
        }
        .earn-cat {
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--ember);
        }
        .earn-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 12px;
          border: 1px solid rgba(255, 107, 26, 0.18);
          background: rgba(12, 12, 14, 0.72);
          transition: border-color 0.15s ease, background 0.15s ease, transform 0.12s ease;
        }
        .earn-row:not(:disabled):active {
          transform: scale(0.99);
          border-color: rgba(255, 107, 26, 0.5);
          background: rgba(255, 107, 26, 0.1);
        }
        .earn-row.is-pending {
          border-color: rgba(255, 179, 71, 0.45);
          background: rgba(255, 179, 71, 0.06);
        }
        .earn-row.is-done {
          opacity: 0.55;
          border-color: rgba(154, 143, 134, 0.25);
          cursor: default;
        }
        .earn-thumb {
          width: 40px;
          height: 40px;
          flex-shrink: 0;
          overflow: hidden;
          border: 1px solid rgba(255, 107, 26, 0.28);
          background: #0c0c0e;
        }
        .earn-row-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--paper);
        }
        .earn-reward {
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: var(--ember);
        }
        .earn-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 36px;
          height: 28px;
          padding: 0 8px;
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.12em;
        }
        .earn-badge.is-go {
          color: var(--ink);
          background: var(--ember);
        }
        .earn-badge.is-ok {
          color: #7dffb3;
          border: 1px solid rgba(125, 255, 179, 0.45);
          background: rgba(125, 255, 179, 0.08);
        }
        .earn-badge.is-wait {
          color: #ffb347;
          border: 1px solid rgba(255, 179, 71, 0.45);
          background: rgba(255, 179, 71, 0.08);
        }
        .earn-empty {
          padding: 28px 16px;
          text-align: center;
          border: 1px dashed rgba(255, 107, 26, 0.3);
          background: rgba(255, 107, 26, 0.04);
        }
      `}</style>
    </div>
  );
}
