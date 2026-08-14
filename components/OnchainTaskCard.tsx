// components/OnchainTaskCard.tsx

import React from 'react';
import Image from 'next/image';
import { Address, fromNano } from '@ton/core';
import { useToast } from '@/contexts/ToastContext';
import Copy from '@/icons/Copy';

const AddressDisplay = ({ address }: { address: string }) => {
    const showToast = useToast();

    const formatAddress = (addr: string) => {
        const parsed = Address.parse(addr).toString();
        if (parsed.length <= 10) return parsed;
        return `${parsed.slice(0, 5)}...${parsed.slice(-5)}`;
    };

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(Address.parse(address).toString());
            showToast('Address copied to clipboard', 'success');
        } catch (err) {
            showToast('Failed to copy address', 'error');
        }
    };

    return (
        <button
            onClick={copyToClipboard}
            className="text-xl font-semibold mb-2 flex items-center hover:text-[#f3ba2f] transition-colors"
        >
            {formatAddress(address)}
            <Copy size={24} className="ml-2" />
        </button>
    );
};

export type ExtendedOnchainTask = {
    id: string;
    smartContractAddress: string;
    points: number;
    price: string;
    isActive: boolean;
    collectionMetadata: {
        name?: string;
        description?: string;
        image?: string;
        cover_image?: string;
        social_links?: string[];
    } | null;
    itemMetadata: {
        name?: string;
        description?: string;
        image?: string;
    } | null;
};

interface OnchainTaskCardProps {
    task: ExtendedOnchainTask;
    onEdit: (task: ExtendedOnchainTask) => void;
}

const OnchainTaskCard: React.FC<OnchainTaskCardProps> = ({ task, onEdit }) => {
    return (
        <div className="bg-[#3a3d42] rounded-lg overflow-hidden shadow-lg">
            {task.collectionMetadata?.cover_image && (
                <div className="relative h-40 w-full">
                    <Image
                        src={task.collectionMetadata.cover_image}
                        alt="Collection Cover"
                        layout="fill"
                        objectFit="cover"
                    />
                </div>
            )}
            <div className="p-6">
                {/* Collection Info */}
                <div className="mb-6">
                    <h3 className="text-2xl font-bold text-white mb-2">{task.collectionMetadata?.name || 'Unnamed Collection'}</h3>
                    <p className="text-gray-400 mb-4">{task.collectionMetadata?.description || 'No description available'}</p>
                    <div className="flex items-center mb-4">
                        {task.collectionMetadata?.image && (
                            <div className="relative h-16 w-16 rounded-full overflow-hidden mr-4">
                                <Image
                                    src={task.collectionMetadata.image}
                                    alt="Collection Avatar"
                                    layout="fill"
                                    objectFit="cover"
                                />
                            </div>
                        )}
                        <AddressDisplay address={task.smartContractAddress} />
                    </div>
                    {task.collectionMetadata?.social_links && task.collectionMetadata.social_links.length > 0 && (
                        <div className="flex space-x-2 mb-4">
                            {task.collectionMetadata.social_links.map((link, index) => (
                                <a key={index} href={link} target="_blank" rel="noopener noreferrer" className="text-[#f3ba2f] hover:underline">
                                    Link {index + 1}
                                </a>
                            ))}
                        </div>
                    )}
                </div>

                {/* Item Info */}
                <div className="mb-6">
                    <h4 className="text-xl font-semibold text-white mb-2">{task.itemMetadata?.name || 'Unnamed Item'}</h4>
                    <p className="text-gray-400 mb-4">{task.itemMetadata?.description || 'No description available'}</p>
                    {task.itemMetadata?.image && (
                        <div className="relative h-64 w-full rounded-lg overflow-hidden mb-4">
                            <Image
                                src={task.itemMetadata.image}
                                alt="Item Image"
                                layout="fill"
                                objectFit="cover"
                            />
                        </div>
                    )}
                </div>

                {/* Task Info */}
                <div className="grid grid-cols-2 gap-4 text-gray-400">
                    <p>Points: <span className="text-white font-semibold">{task.points}</span></p>
                    <p>Price: <span className="text-white font-semibold">{fromNano(task.price)} TON</span></p>
                    <p>Active: <span className={`font-semibold ${task.isActive ? 'text-green-500' : 'text-red-500'}`}>{task.isActive ? 'Yes' : 'No'}</span></p>
                </div>

                <button
                    onClick={() => onEdit(task)}
                    className="w-full mt-6 px-4 py-2 bg-[#f3ba2f] text-black rounded-lg hover:bg-[#f4c141] transition-colors font-semibold"
                >
                    Edit
                </button>
            </div>
        </div>
    );
};

export default OnchainTaskCard;