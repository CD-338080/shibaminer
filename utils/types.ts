// utils/types.ts.ts

/**
 * This project was developed by Nikandr Surkov.
 * You may not use this code if you purchased it from any source other than the official website https://nikandr.com.
 * If you purchased it from the official website, you may use it for your own projects,
 * but you may not resell it or publish it publicly.
 * 
 * Website: https://nikandr.com
 * YouTube: https://www.youtube.com/@NikandrSurkov
 * Telegram: https://t.me/nikandr_s
 * Telegram channel for news/updates: https://t.me/clicker_game_news
 * GitHub: https://github.com/nikandr-surkov
 */

export type IconProps = {
    size?: number;
    className?: string;
}

export interface Task {
    id: string;
    title: string;
    description: string;
    points: number;
    type: string;
    category: string;
    image: string;
    callToAction: string;
    taskData: any;
    taskStartTimestamp: Date | null;
    isCompleted: boolean;
}

export interface TaskPopupProps {
    task: Task;
    onClose: () => void;
    onUpdate: (updatedTask: Task) => void;
}