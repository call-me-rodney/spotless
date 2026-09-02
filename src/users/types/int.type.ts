export interface CreateUserResponse {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    collectorId?: string;
    isActive: boolean;
}

