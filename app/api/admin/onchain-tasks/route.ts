// app/api/admin/onchain-tasks/route.ts

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

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/utils/prisma';
import { getHttpEndpoint } from '@orbs-network/ton-access';
import { NftCollection } from '@/utils/contract-build/NftCollection/tact_NftCollection';
import { NftItem } from '@/utils/contract-build/NftCollection/tact_NftItem';
import { Address, Cell, OpenedContract } from '@ton/core';
import { TonClient } from '@ton/ton';


export async function GET(req: NextRequest) {
    const isLocalhost = req.headers.get('host')?.includes('localhost');
    const isAdminAccessEnabled = process.env.ACCESS_ADMIN === 'true';

    if (!isLocalhost || !isAdminAccessEnabled) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const onchainTasks = await prisma.onchainTask.findMany();
    return NextResponse.json(onchainTasks);
}

function decodeCell(cell: Cell): string {
    let slice = cell.beginParse();
    slice.loadUint(8); // Skip the first byte
    return slice.loadStringTail();
}

async function fetchJsonFromIpfs(url: string) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching data from IPFS:', error);
        return null;
    }
}

export async function POST(req: NextRequest) {
    const isLocalhost = req.headers.get('host')?.includes('localhost');
    const isAdminAccessEnabled = process.env.ACCESS_ADMIN === 'true';

    if (!isLocalhost || !isAdminAccessEnabled) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const taskData = await req.json();
        console.log('Received task data:', taskData);

        // Validate TON address
        let address: Address;
        try {
            address = Address.parse(taskData.smartContractAddress);
            console.log('Parsed address:', address.toString());
        } catch (error) {
            console.error('Error parsing address:', error);
            return NextResponse.json({ error: 'Invalid TON address provided' }, { status: 400 });
        }

        // Check if a task with this address already exists
        const existingTask = await prisma.onchainTask.findFirst({
            where: { smartContractAddress: address.toRawString() }
        });

        if (existingTask) {
            return NextResponse.json({ error: 'An onchain task with this address already exists' }, { status: 409 });
        }

        // Initialize TonClient
        const endpoint = await getHttpEndpoint({ network: 'mainnet' });
        console.log('Using endpoint:', endpoint);
        const client = new TonClient({ endpoint });

        // Create NftCollection instance
        const contract = NftCollection.fromAddress(address);
        console.log('Created contract instance:', contract);

        // Open the contract
        let openedContract: OpenedContract<NftCollection>;
        try {
            openedContract = client.open(contract) as OpenedContract<NftCollection>;
            console.log('Opened contract successfully');
        } catch (error) {
            console.error('Error opening contract:', error);
            return NextResponse.json({ error: 'Failed to open contract. This might not be a valid NFT Collection contract.' }, { status: 400 });
        }

        // Fetch data from the smart contract
        let nftPrice, collectionData, itemData, collectionMetadata, itemMetadata;
        try {
            // Validate that the contract has the expected methods
            if (typeof openedContract.getGetNftMintTotalCost !== 'function' ||
                typeof openedContract.getGetCollectionData !== 'function' ||
                typeof openedContract.getGetNftAddressByIndex !== 'function') {
                throw new Error('Contract does not have expected methods');
            }

            nftPrice = await openedContract.getGetNftPrice();
            if (typeof nftPrice !== 'bigint') {
                throw new Error('Invalid NFT price');
            }
            console.log('NFT Price:', nftPrice.toString());

            collectionData = await openedContract.getGetCollectionData();
            if (!collectionData || !collectionData.collection_content) {
                throw new Error('Invalid collection data');
            }
            console.log('Collection Data:', collectionData);

            // Decode collection metadata
            const collectionMetadataUrl = decodeCell(collectionData.collection_content);
            if (!collectionMetadataUrl.startsWith('http')) {
                throw new Error('Invalid collection metadata URL');
            }
            console.log('Collection Metadata URL:', collectionMetadataUrl);
            collectionMetadata = await fetchJsonFromIpfs(collectionMetadataUrl);
            if (!collectionMetadata) {
                throw new Error('Failed to fetch collection metadata');
            }
            console.log('Collection Metadata:', collectionMetadata);

            // For item metadata, we need to get the first item's data
            const nftItemAddress = await openedContract.getGetNftAddressByIndex(BigInt(0));
            console.log('NFT Item Address:', nftItemAddress?.toString());

            if (nftItemAddress) {
                const nftItemContract = NftItem.fromAddress(nftItemAddress);
                const openedNftItemContract = client.open(nftItemContract as any) as OpenedContract<NftItem>;
                if (typeof openedNftItemContract.getGetNftData !== 'function') {
                    throw new Error('Invalid NFT item contract');
                }
                itemData = await openedNftItemContract.getGetNftData();
                if (!itemData || !itemData.individual_content) {
                    throw new Error('Invalid item data');
                }
                console.log('Item Data:', itemData);
                const itemMetadataUrl = decodeCell(itemData.individual_content);
                if (!itemMetadataUrl.startsWith('http')) {
                    throw new Error('Invalid item metadata URL');
                }
                console.log('Item Metadata URL:', itemMetadataUrl);
                itemMetadata = await fetchJsonFromIpfs(itemMetadataUrl);
                if (!itemMetadata) {
                    throw new Error('Failed to fetch item metadata');
                }
                console.log('Item Metadata:', itemMetadata);
            } else {
                console.log('No NFT items found in the collection');
            }
        } catch (error) {
            console.error('Error fetching data from contract:', error);
            return NextResponse.json({ error: 'Failed to fetch data from contract. This might not be a valid NFT Collection contract.' }, { status: 400 });
        }

        // Create the task in the database
        try {
            const task = await prisma.onchainTask.create({
                data: {
                    smartContractAddress: address.toRawString(),
                    points: taskData.points,
                    isActive: taskData.isActive,
                    price: nftPrice.toString(),
                    collectionMetadata: collectionMetadata || {},
                    itemMetadata: itemMetadata || {},
                }
            });
            console.log('Created task:', task);
            return NextResponse.json(task);
        } catch (error) {
            console.error('Error creating task in database:', error);
            return NextResponse.json({ error: 'Failed to create task in database' }, { status: 500 });
        }
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
    }
}