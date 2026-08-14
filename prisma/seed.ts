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


import 'tsconfig-paths/register';
import prisma from '@/utils/prisma';
import { TaskType } from '@prisma/client';
import { earnData } from '@/utils/tasks-data';

async function main() {
  console.log('Start seeding...');

  for (const category of earnData) {
    for (const task of category.tasks) {
      // Convert the string type to TaskType enum
      const taskType = TaskType[task.type as keyof typeof TaskType];

      const createdTask = await prisma.task.create({
        data: {
          title: task.title,
          description: task.description,
          points: task.points,
          type: taskType, // Use the converted TaskType enum value
          category: category.category,
          image: task.image,
          callToAction: task.callToAction,
          taskData: task.taskData,
        },
      });
      console.log(`Created task with id: ${createdTask.id}`);
    }
  }

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });