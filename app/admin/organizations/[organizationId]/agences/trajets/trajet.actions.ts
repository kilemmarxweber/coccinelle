"use server";
import prisma from "@/lib/prisma";

export const getTrajets = async () => {
  return prisma.trajet.findMany({
    include: {
      trajetDepart: {
        orderBy: {
          dateDepart: "asc",
        },
      },
      trajetProgramme: true,
    },
  });
};
