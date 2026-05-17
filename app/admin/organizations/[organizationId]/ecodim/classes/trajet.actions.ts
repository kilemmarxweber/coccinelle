import prisma from "@/lib/prisma";

export const getTrajets = async () => {
  return prisma.trajet.findMany();
};
