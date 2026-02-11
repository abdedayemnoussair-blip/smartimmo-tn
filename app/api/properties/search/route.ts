import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      type,
      transactionType,
      city,
      governorate,
      minPrice,
      maxPrice,
      minSurface,
      maxSurface,
      bedrooms,
      budget,
      tenantType,
    } = body;

    const where: Prisma.PropertyWhereInput = {
      status: "PUBLISHED",
      ...(type && { type }),
      ...(transactionType && { transactionType }),
      ...(city && { city }),
      ...(governorate && { governorate }),
      ...(minSurface && { surface: { gte: minSurface } }),
      ...(maxSurface && { surface: { lte: maxSurface } }),
      ...(bedrooms && { bedrooms }),
    };

    let properties = await prisma.property.findMany({
      where,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            image: true,
          },
        },
        agency: {
          select: {
            id: true,
            name: true,
            logo: true,
            verified: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    properties = properties.filter((property) => {
      let marginPercent = 0;
      
      if (property.negMargin === "PEU_NEGOCIABLE") {
        marginPercent = 0.1;
      } else if (property.negMargin === "NEGOCIABLE") {
        marginPercent = 0.2;
      }

      const effectiveMinPrice = property.price * (1 - marginPercent);
      const budgetInRange = budget ? budget >= effectiveMinPrice : true;
      const priceInRange = 
        (!minPrice || property.price >= minPrice) &&
        (!maxPrice || property.price <= maxPrice);
      
      const tenantMatch = !tenantType || 
        property.tenantTypes.includes("TOUS") || 
        property.tenantTypes.includes(tenantType);

      return budgetInRange && priceInRange && tenantMatch;
    });

    const propertiesWithoutMargin = properties.map((property) => {
      const { negMargin, margPercentage, ...rest } = property;
      return rest;
    });

    return NextResponse.json({
      success: true,
      properties: propertiesWithoutMargin,
      count: propertiesWithoutMargin.length,
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
