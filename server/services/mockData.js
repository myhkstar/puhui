export const mockUsers = [];
export const mockImages = [];
export const mockChatSessions = [];
export const mockChatMessages = [];
export const mockUsageLogs = [];
export let nextUserId = 1;

export const incrementNextUserId = () => {
    return nextUserId++;
};
