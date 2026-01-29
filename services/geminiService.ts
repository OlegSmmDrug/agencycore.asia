
import { Project, Client, Task, ProjectStatus, ClientStatus, AIAgent, Message } from "../types";
import { processAgentResponse as claudeProcessAgentResponse } from './claudeService';

// MOCK IMPLEMENTATION (No API Key required)

export { claudeProcessAgentResponse as processAgentResponse };

export const generateExecutiveSummary = async (
  clients: Client[],
  projects: Project[],
  tasks: Task[]
): Promise<string> => {
  const activeProjects = projects.filter(p => p.status === ProjectStatus.IN_WORK).length;
  const totalBudget = projects.reduce((acc, curr) => acc + curr.budget, 0);
  
  // Return a static mock response mimicking the AI
  return `📊 Анализ (Mock):
  
1. Финансы: Общий пайплайн составляет ${totalBudget.toLocaleString()} ₸. 
2. Загрузка: В работе ${activeProjects} активных проектов.
3. Рекомендация: Сосредоточьтесь на закрытии актов по завершенным задачам.

(AI функции временно отключены для облегчения установки)`;
};

export const suggestProjectTasks = async (projectName: string, description: string): Promise<string[]> => {
    return [
        "Провести установочную встречу (Mock)",
        "Запросить доступы к ресурсам",
        "Подготовить стратегию продвижения",
        "Согласовать контент-план",
        "Настроить аналитику"
    ];
};

export const parseQuickTask = async (input: string, projects: Project[]): Promise<Partial<Task>> => {
    const result: Partial<Task> = {
        title: input,
        priority: 'Medium' as const,
        type: 'Task' as const
    };

    const lowerInput = input.toLowerCase();

    if (lowerInput.includes('срочно') || lowerInput.includes('urgent')) {
        result.priority = 'High';
    }

    if (lowerInput.includes('съемка') || lowerInput.includes('съёмка')) {
        result.type = 'Shooting';
    } else if (lowerInput.includes('встреча') || lowerInput.includes('звонок')) {
        result.type = lowerInput.includes('звонок') ? 'Call' : 'Meeting';
    }

    const timeMatch = input.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
        const hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        result.startedAt = date.toISOString();
        result.deadline = new Date(date.getTime() + 60 * 60 * 1000).toISOString();
    }

    if (lowerInput.includes('завтра')) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (result.startedAt) {
            const time = new Date(result.startedAt);
            tomorrow.setHours(time.getHours(), time.getMinutes(), 0, 0);
        }
        result.startedAt = tomorrow.toISOString();
        result.deadline = new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString();
    }

    for (const project of projects) {
        if (lowerInput.includes(project.name.toLowerCase())) {
            result.projectId = project.id;
            break;
        }
    }

    return result;
}
