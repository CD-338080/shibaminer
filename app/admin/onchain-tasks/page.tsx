// app/admin/onchain-tasks/page.tsx

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

'use client';

import { useState, useEffect, useCallback } from 'react';
import { OnchainTask } from '@prisma/client';
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from '@/contexts/ToastContext';
import { Address, fromNano } from '@ton/core';
import Copy from '@/icons/Copy';
import OnchainTaskCard, { ExtendedOnchainTask } from '@/components/OnchainTaskCard';

const onchainTaskSchema = z.object({
    smartContractAddress: z.string().min(1, "Smart contract address is required"),
    points: z.number().min(0, "Points must be a positive number").nullable(),
    isActive: z.boolean(),
});

type OnchainTaskFormData = z.infer<typeof onchainTaskSchema>;

const DEFAULT_FORM_VALUES: OnchainTaskFormData = {
    smartContractAddress: '',
    points: null,
    isActive: true,
};

export default function AdminOnchainTasks() {
    const showToast = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [onchainTasks, setOnchainTasks] = useState<OnchainTask[]>([]);
    const [editingTask, setEditingTask] = useState<OnchainTask | null>(null);
    const [isLoadingTasks, setIsLoadingTasks] = useState(true);

    const { register, handleSubmit, reset, formState: { errors } } = useForm<OnchainTaskFormData>({
        resolver: zodResolver(onchainTaskSchema),
        defaultValues: DEFAULT_FORM_VALUES,
    });

    const fetchOnchainTasks = useCallback(async () => {
        setIsLoadingTasks(true);
        try {
            const response = await fetch('/api/admin/onchain-tasks');
            const data = await response.json();
            setOnchainTasks(data);
        } catch (error) {
            console.error('Error fetching onchain tasks:', error);
        } finally {
            setIsLoadingTasks(false);
        }
    }, []);

    useEffect(() => {
        fetchOnchainTasks();
    }, [fetchOnchainTasks]);

    const onSubmit = async (data: OnchainTaskFormData) => {
        setIsSubmitting(true);
        try {
            let response;
            if (editingTask) {
                response = await fetch(`/api/admin/onchain-tasks/${editingTask.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });
            } else {
                response = await fetch('/api/admin/onchain-tasks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save onchain task');
            }

            showToast(editingTask ? 'Onchain task updated successfully!' : 'Onchain task created successfully!', 'success');
            setEditingTask(null);
            reset(DEFAULT_FORM_VALUES);
            fetchOnchainTasks();
        } catch (error) {
            console.error('Error saving onchain task:', error);
            if (error instanceof Error) {
                showToast(`Failed to save onchain task: ${error.message}`, 'error');
            } else {
                showToast('Failed to save onchain task. Please try again.', 'error');
            }
        } finally {
            setIsSubmitting(false); // Reset loading state when done
        }
    };

    function isExtendedOnchainTask(task: any): task is ExtendedOnchainTask {
        return (
            task &&
            typeof task.id === 'string' &&
            typeof task.smartContractAddress === 'string' &&
            typeof task.points === 'number' &&
            typeof task.price === 'string' &&
            typeof task.isActive === 'boolean' &&
            (task.collectionMetadata === null || typeof task.collectionMetadata === 'object') &&
            (task.itemMetadata === null || typeof task.itemMetadata === 'object')
        );
    }

    const handleEdit = (task: OnchainTask) => {
        setEditingTask(task);
        reset({
            smartContractAddress: task.smartContractAddress,
            points: task.points,
            isActive: task.isActive,
        });
    };

    const handleCancelEdit = () => {
        setEditingTask(null);
        reset(DEFAULT_FORM_VALUES);
    };

    return (
        <div className="bg-[#1d2025] text-white min-h-screen p-8">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-4xl font-bold mb-8 text-[#f3ba2f]">Manage Onchain Tasks</h1>

                <form onSubmit={handleSubmit(onSubmit)} className="mb-12 bg-[#272a2f] rounded-lg p-6">
                    <h2 className="text-2xl font-semibold mb-6">{editingTask ? 'Edit Onchain Task' : 'Add New Onchain Task'}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <input
                                {...register("smartContractAddress")}
                                placeholder="Smart Contract Address"
                                className="w-full bg-[#3a3d42] p-3 rounded-lg"
                                autoComplete="off"
                                readOnly={!!editingTask}
                                disabled={isSubmitting}
                            />
                            {errors.smartContractAddress && <p className="text-red-500 text-sm mt-1">{errors.smartContractAddress.message}</p>}
                        </div>

                        <div>
                            <input
                                type="number"
                                {...register("points", { valueAsNumber: true })}
                                placeholder="Points"
                                className="w-full bg-[#3a3d42] p-3 rounded-lg"
                                autoComplete="off"
                                disabled={isSubmitting}
                            />
                            {errors.points && <p className="text-red-500 text-sm mt-1">{errors.points.message}</p>}
                        </div>

                        <label className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                {...register("isActive")}
                                className="form-checkbox h-5 w-5 text-[#f3ba2f]"
                                disabled={isSubmitting}
                            />
                            <span>Is Active</span>
                        </label>
                    </div>
                    <div className="mt-6 flex justify-end space-x-4">
                        {editingTask && (
                            <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isSubmitting}
                            >
                                Cancel
                            </button>
                        )}
                        <button
                            type="submit"
                            className="px-6 py-2 bg-[#f3ba2f] text-black rounded-lg hover:bg-[#f4c141] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    {editingTask ? 'Updating...' : 'Creating...'}
                                </>
                            ) : (
                                editingTask ? 'Update Onchain Task' : 'Add Onchain Task'
                            )}
                        </button>
                    </div>
                </form>

                <div className="bg-[#272a2f] rounded-lg p-6">
                    <h2 className="text-2xl font-semibold mb-6">Existing Onchain Tasks ({onchainTasks.length})</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {isLoadingTasks ? (
                            [...Array(6)].map((_, index) => (
                                <div key={index} className="bg-[#3a3d42] rounded-lg p-4 animate-pulse">
                                    <div className="h-6 bg-gray-700 rounded w-3/4 mb-4"></div>
                                    <div className="h-4 bg-gray-700 rounded w-1/2 mb-2"></div>
                                    <div className="h-4 bg-gray-700 rounded w-1/4"></div>
                                </div>
                            ))
                        ) : onchainTasks.length > 0 ? (
                            onchainTasks.map(task => {
                                if (isExtendedOnchainTask(task)) {
                                    return (
                                        <OnchainTaskCard
                                            key={task.id}
                                            task={task}
                                            onEdit={handleEdit}
                                        />
                                    );
                                }
                                return null; // or some fallback UI for invalid tasks
                            })
                        ) : (
                            <div className="col-span-full text-center text-gray-400 bg-[#3a3d42] rounded-lg p-8">
                                No onchain tasks available
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}