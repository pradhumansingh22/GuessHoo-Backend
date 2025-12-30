import bcrypt from "bcrypt";

export const adminMiddleware = async (hash: string) => {
    const adminPass = process.env.ADMIN_PASSWORD!;
    const isAdmin = bcrypt.compare(adminPass, hash);
    return isAdmin;
}