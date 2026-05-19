"use server";

import prisma from "@/lib/prisma";

export async function searchClients(query: string, organizationId: string) {
  if (!query || !organizationId) return [];

  const q = query.trim();

  const clients = await prisma.client.findMany({
    where: {
      user: {
        members: {
          some: { organizationId },
        },
      },

      OR: [
        {
          user: {
            name: {
              contains: q,
              mode: "insensitive",
            },
          },
        },
        {
          user: {
            email: {
              contains: q,
              mode: "insensitive",
            },
          },
        },
        {
          telephone: {
            contains: q,
          },
        },
        {
          societe: {
            contains: q,
            mode: "insensitive",
          },
        },
      ],
    },

    include: {
      user: true,
    },

    take: 10,
  });

  return clients.map((c) => {
    const nameuser = c.user.name?.split(" ") || [];

    return {
      id: c.id,
      nom: nameuser[0] || "",

      prenom: c.prenom ?? "",
      postnom: c.postnom ?? "",
      adresse: c.adresse ?? "",

      telephone: c.telephone ?? "",
      email: c.user.email ?? "",
      societe: c.societe ?? "",

      dateInscription: c.dateInscription
        ? new Date(c.dateInscription).toISOString().split("T")[0]
        : "",
    };
  });
}
