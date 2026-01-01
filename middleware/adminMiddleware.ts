import bcrypt from "bcrypt";

export const adminMiddleware = async (password: string) => {
    const hash = process.env.HASH!;
    const isAdmin = await bcrypt.compare(password, hash);
   // console.log(isAdmin);
    return isAdmin;
}