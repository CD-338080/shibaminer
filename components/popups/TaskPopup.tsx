'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import ShibaCoin from '@/icons/ShibaCoin';
import { useGameStore } from '@/utils/game-mechanics';
import { formatNumber, triggerHapticFeedback } from '@/utils/ui';
import { imageMap } from '@/images';
import { useHydration } from '@/utils/useHydration';
import { TASK_WAIT_TIME } from '@/utils/consts';
import { useToast } from '@/contexts/ToastContext';
import { TaskPopupProps } from '@/utils/types';

const TaskPopup: React.FC<TaskPopupProps> = React.memo(({ task, onClose, onUpdate }) => {
  const [isClosing, setIsClosing] = useState(false);
  const showToast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { userTelegramInitData, incrementPoints } = useGameStore();
  const isHydrated = useHydration();
  const [localTask, setLocalTask] = useState(task);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isTimerFinished, setIsTimerFinished] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setLocalTask(task);
  }, [task]);

  const handleStart = useCallback(async () => {
    setIsLoading(true);
    try {
      triggerHapticFeedback(window);
      const response = await fetch('/api/tasks/update/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: userTelegramInitData,
          taskId: localTask.id,
        }),
      });

      if (!response.ok) throw new Error('Failed to start task');

      const data = await response.json();
      const updatedTask = {
        ...localTask,
        taskStartTimestamp: new Date(data.taskStartTimestamp),
      };
      setLocalTask(updatedTask);
      onUpdate(updatedTask);
      showToast('Quest started!', 'success');

      if (localTask.type === 'VISIT' && localTask.taskData?.link) {
        window.open(localTask.taskData.link, '_blank');
      }
    } catch (error) {
      console.error('Error starting task:', error);
      showToast('Failed to start quest. Try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [localTask, userTelegramInitData, onUpdate, showToast]);

  const handleCheck = async () => {
    setIsLoading(true);
    try {
      triggerHapticFeedback(window);
      let response;
      if (localTask.type === 'VISIT') {
        response = await fetch('/api/tasks/check/visit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            initData: userTelegramInitData,
            taskId: localTask.id,
          }),
        });
      } else if (localTask.type === 'REFERRAL') {
        response = await fetch('/api/tasks/check/referral', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            initData: userTelegramInitData,
            taskId: localTask.id,
          }),
        });
      } else if (localTask.type === 'TELEGRAM') {
        response = await fetch('/api/tasks/check/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            initData: userTelegramInitData,
            taskId: localTask.id,
          }),
        });
      } else {
        throw new Error(`Unsupported task type: ${localTask.type}`);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to check ${localTask.type} task`);
      }

      const data = await response.json();

      if (data.success) {
        const updatedTask = { ...localTask, isCompleted: data.isCompleted };
        setLocalTask(updatedTask);
        onUpdate(updatedTask);
        incrementPoints(updatedTask.points);
        showToast(data.message || 'Quest complete — SHIB added!', 'success');
      } else if (
        localTask.type === 'REFERRAL' &&
        data.currentReferrals !== undefined &&
        data.requiredReferrals !== undefined
      ) {
        const remainingReferrals = data.requiredReferrals - data.currentReferrals;
        showToast(
          `Need ${remainingReferrals} more referral${remainingReferrals > 1 ? 's' : ''} (${data.currentReferrals}/${data.requiredReferrals})`,
          'error'
        );
      } else {
        showToast(data.message || 'Quest not complete yet.', 'error');
      }
    } catch (error) {
      console.error('Error checking task:', error);
      showToast(
        error instanceof Error ? error.message : 'Failed to check quest.',
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const getTimeRemaining = useCallback(() => {
    if (!localTask.taskStartTimestamp) return null;
    const now = new Date();
    const startTime = new Date(localTask.taskStartTimestamp);
    const elapsedTime = now.getTime() - startTime.getTime();
    return Math.max(TASK_WAIT_TIME - elapsedTime, 0);
  }, [localTask.taskStartTimestamp]);

  const formatTime = useCallback((ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  useEffect(() => {
    if (isHydrated && localTask.taskStartTimestamp && !localTask.isCompleted) {
      const updateTimer = () => {
        const remaining = getTimeRemaining();
        setTimeRemaining(remaining);
        if (remaining === 0) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setIsTimerFinished(true);
        } else {
          setIsTimerFinished(false);
        }
      };

      updateTimer();
      intervalRef.current = setInterval(updateTimer, 1000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [isHydrated, localTask.taskStartTimestamp, localTask.isCompleted, getTimeRemaining]);

  const handleClose = () => {
    triggerHapticFeedback(window);
    setIsClosing(true);
    setTimeout(() => onClose(), 280);
  };

  const taskImage = imageMap[localTask.image];
  const visitWaiting =
    !!localTask.taskStartTimestamp && !isTimerFinished && !localTask.isCompleted;
  const visitReady =
    !!localTask.taskStartTimestamp && isTimerFinished && !localTask.isCompleted;

  const sheet = (
    <div
      className="tp-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={localTask.title}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className={`tp-sheet ${isClosing ? 'is-out' : 'is-in'}`}>
        <div className="tp-handle" />
        <div className="tp-head">
          <p className="tp-eyebrow">Quest</p>
          <button type="button" className="tp-close" onClick={handleClose} aria-label="Close">
            &times;
          </button>
        </div>

        <h2 className="tp-title">{localTask.title}</h2>

        <div className="tp-media">
          {taskImage ? (
            <Image
              src={taskImage}
              alt=""
              width={72}
              height={72}
              className="tp-img"
            />
          ) : (
            <ShibaCoin size={72} />
          )}
        </div>

        <p className="tp-desc">{localTask.description}</p>

        <div className="tp-reward">
          <ShibaCoin size={22} />
          <span>+{formatNumber(localTask.points)} SHIB</span>
        </div>

        {localTask.taskData?.link && (
          <button
            type="button"
            className="tp-link"
            onClick={() => {
              triggerHapticFeedback(window);
              window.open(localTask.taskData.link, '_blank');
            }}
          >
            {localTask.callToAction || 'Open link'} ↗
          </button>
        )}

        {localTask.type === 'VISIT' ? (
          <button
            type="button"
            className={`tp-cta ${
              isLoading || localTask.isCompleted || visitWaiting ? 'is-off' : 'is-on'
            }`}
            onClick={
              localTask.taskStartTimestamp
                ? visitReady
                  ? handleCheck
                  : undefined
                : handleStart
            }
            disabled={Boolean(
              isLoading || localTask.isCompleted || visitWaiting
            )}
          >
            {isLoading ? (
              <span className="tp-spin" />
            ) : localTask.isCompleted ? (
              'Completed'
            ) : localTask.taskStartTimestamp ? (
              isHydrated
                ? timeRemaining === 0
                  ? 'Claim SHIB'
                  : `Wait ${formatTime(timeRemaining || 0)}`
                : '…'
            ) : (
              'Start quest'
            )}
          </button>
        ) : (
          <button
            type="button"
            className={`tp-cta ${isLoading || localTask.isCompleted ? 'is-off' : 'is-on'}`}
            onClick={handleCheck}
            disabled={isLoading || localTask.isCompleted}
          >
            {isLoading ? (
              <span className="tp-spin" />
            ) : localTask.isCompleted ? (
              'Completed'
            ) : (
              'Check & claim'
            )}
          </button>
        )}
      </div>

      <style jsx global>{`
        .tp-overlay {
          position: fixed;
          inset: 0;
          z-index: 200;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          background: rgba(0, 0, 0, 0.72);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          padding: 0;
        }
        .tp-sheet {
          width: 100%;
          max-width: 36rem;
          max-height: 88dvh;
          overflow-y: auto;
          padding: 12px 20px calc(24px + env(safe-area-inset-bottom, 0px));
          background: linear-gradient(180deg, #1a1512 0%, #0c0c0e 100%);
          border-top: 1px solid rgba(255, 107, 26, 0.45);
          color: #f4ebe3;
          font-family: 'Syne', system-ui, sans-serif;
        }
        .tp-sheet.is-in {
          animation: tpSlideIn 0.28s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .tp-sheet.is-out {
          animation: tpSlideOut 0.26s ease-in both;
        }
        @keyframes tpSlideIn {
          from {
            transform: translateY(110%);
            opacity: 0.6;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes tpSlideOut {
          from {
            transform: translateY(0);
            opacity: 1;
          }
          to {
            transform: translateY(110%);
            opacity: 0.4;
          }
        }
        .tp-handle {
          width: 40px;
          height: 4px;
          margin: 0 auto 12px;
          border-radius: 999px;
          background: rgba(244, 235, 227, 0.28);
        }
        .tp-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .tp-eyebrow {
          margin: 0;
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: #ff6b1a;
        }
        .tp-close {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          line-height: 1;
          color: #9a8f86;
          border: 1px solid rgba(244, 235, 227, 0.2);
          background: transparent;
        }
        .tp-title {
          margin: 0 0 14px;
          font-size: 1.45rem;
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.15;
          text-align: center;
        }
        .tp-media {
          display: flex;
          justify-content: center;
          margin-bottom: 14px;
        }
        .tp-img {
          border: 1px solid rgba(255, 107, 26, 0.35);
          object-fit: cover;
        }
        .tp-desc {
          margin: 0 0 16px;
          text-align: center;
          font-size: 13px;
          font-weight: 600;
          line-height: 1.45;
          color: #9a8f86;
        }
        .tp-reward {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-bottom: 14px;
          font-size: 1.35rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #ff6b1a;
        }
        .tp-link {
          display: block;
          width: 100%;
          margin-bottom: 12px;
          padding: 12px 14px;
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          text-align: center;
          color: #f4ebe3;
          border: 1px solid rgba(255, 107, 26, 0.4);
          background: rgba(255, 107, 26, 0.1);
        }
        .tp-cta {
          width: 100%;
          padding: 16px;
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 54px;
        }
        .tp-cta.is-on {
          color: #0c0c0e;
          background: #ff6b1a;
          box-shadow: 0 12px 28px rgba(255, 107, 26, 0.28);
        }
        .tp-cta.is-off {
          color: #6b6560;
          background: rgba(244, 235, 227, 0.06);
          border: 1px solid rgba(154, 143, 134, 0.3);
          cursor: not-allowed;
        }
        .tp-spin {
          width: 22px;
          height: 22px;
          border: 2px solid rgba(12, 12, 14, 0.25);
          border-top-color: #0c0c0e;
          border-radius: 50%;
          animation: tpSpin 0.7s linear infinite;
        }
        @keyframes tpSpin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );

  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(sheet, document.body);
});

TaskPopup.displayName = 'TaskPopup';

export default TaskPopup;
