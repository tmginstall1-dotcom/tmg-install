import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { randomBytes } from "crypto";
import { openai } from "./replit_integrations/audio/client"; // Use configured client
import { sendEmail, depositRequestEmail, bookingConfirmationEmail, finalPaymentEmail } from "./email";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // -- Auth Routes (Mocked for now) --
  app.post(api.auth.login.path, async (req, res) => {
    try {
      const { username, password } = api.auth.login.input.parse(req.body);
      const user = await storage.getUserByUsername(username);
      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      // Simple mock auth, in reality use express-session
      res.json(user);
    } catch (e) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.get(api.auth.me.path, async (req, res) => {
    // Return a mock staff user for demonstration
    const staff = await storage.getStaffMembers();
    if (staff.length > 0) {
      res.json(staff[0]);
    } else {
      res.status(401).json({ message: "Not logged in" });
    }
  });

  app.post(api.auth.logout.path, (req, res) => {
    res.json({ message: "Logged out" });
  });

  // -- Staff Routes --
  app.get(api.staff.list.path, async (req, res) => {
    const staff = await storage.getStaffMembers();
    res.json(staff);
  });

  // -- Catalog Routes --
  app.get(api.catalog.list.path, async (req, res) => {
    const search = req.query.search as string | undefined;
    const items = await storage.getCatalogItems(search);
    res.json(items);
  });

  // -- Quotes Routes --
  app.get(api.quotes.list.path, async (req, res) => {
    const status = req.query.status as string | undefined;
    const quotes = await storage.getQuotes(status);
    res.json(quotes);
  });

  app.get(api.quotes.get.path, async (req, res) => {
    const id = parseInt(req.params.id);
    const quote = await storage.getQuote(id);
    if (!quote) return res.status(404).json({ message: "Quote not found" });
    res.json(quote);
  });

  app.post(api.quotes.createFromCustomer.path, async (req, res) => {
    try {
      const input = api.quotes.createFromCustomer.input.parse(req.body);
      
      // Use OpenAI to parse the natural language description
      let aiParsedItems: any[] = [];
      let totalEstimate = 0;
      let aiConfidence = 100;
      let requiresReview = false;

      try {
        const response = await openai.chat.completions.create({
          model: "gpt-5.1",
          messages: [
            {
              role: "system",
              content: `You are an AI assistant for a furniture installation company. 
              Extract furniture items and required services from the user's description.
              Valid service types are: 'install', 'dismantle', 'relocate'.
              Estimate a reasonable unit price (in USD, numerical value only) based on typical industry rates for that item and service.
              Return a JSON object with an 'items' array. Each item should have:
              - 'detectedName': string (e.g. 'IKEA Pax Wardrobe')
              - 'serviceType': string ('install', 'dismantle', or 'relocate')
              - 'quantity': number
              - 'estimatedUnitPrice': number
              - 'confidence': number (0-100)
              Return ONLY valid JSON.`
            },
            {
              role: "user",
              content: input.itemsDescription
            }
          ],
          response_format: { type: "json_object" }
        });

        const parsedContent = JSON.parse(response.choices[0].message.content || '{"items":[]}');
        aiParsedItems = parsedContent.items || [];
        
        let lowestConfidence = 100;
        
        const catalogItems = await storage.getCatalogItems();

        aiParsedItems = aiParsedItems.map((item: any) => {
          totalEstimate += (item.estimatedUnitPrice * item.quantity);
          if (item.confidence < lowestConfidence) lowestConfidence = item.confidence;
          
          // Try to match to catalog
          const matchedCatalogItem = catalogItems.find(c => 
            c.serviceType === item.serviceType && 
            item.detectedName.toLowerCase().includes(c.name.toLowerCase())
          );

          return {
            originalDescription: input.itemsDescription,
            detectedName: item.detectedName,
            serviceType: item.serviceType as string,
            quantity: item.quantity,
            unitPrice: (matchedCatalogItem?.basePrice || item.estimatedUnitPrice).toString(),
            subtotal: ((matchedCatalogItem?.basePrice || item.estimatedUnitPrice) * item.quantity).toString(),
            catalogItemId: matchedCatalogItem?.id
          };
        });

        aiConfidence = lowestConfidence;
        requiresReview = aiConfidence < 80 || aiParsedItems.length === 0;

      } catch (err) {
        console.error("AI parsing failed", err);
        requiresReview = true;
        aiConfidence = 0;
        // Fallback item
        aiParsedItems = [{
          originalDescription: input.itemsDescription,
          detectedName: "Custom Item (Needs Review)",
          serviceType: "install",
          quantity: 1,
          unitPrice: "0",
          subtotal: "0"
        }];
      }

      const referenceNo = `TMG-${randomBytes(4).toString('hex').toUpperCase()}`;

      const quote = await storage.createQuote(
        input.customer,
        {
          referenceNo,
          serviceAddress: input.serviceAddress,
          status: 'submitted',
          subtotal: totalEstimate.toString(),
          total: totalEstimate.toString(),
          aiConfidenceScore: aiConfidence,
          requiresManualReview: requiresReview,
          paymentStatus: 'unpaid'
        },
        aiParsedItems
      );

      res.status(201).json(quote);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch(api.quotes.updateStatus.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const input = api.quotes.updateStatus.input.parse(req.body);
      
      const quote = await storage.updateQuoteStatus(
        id, 
        input.status, 
        {
          actorType: 'admin', // Normally determined by auth
          note: input.note,
          photoUrl: input.photoUrl,
          gpsLat: input.gpsLat ? input.gpsLat.toString() : undefined,
          gpsLng: input.gpsLng ? input.gpsLng.toString() : undefined
        },
        input.assignedStaffId
      );
      
      if (!quote) return res.status(404).json({ message: "Quote not found" });
      
      // Send email when deposit is requested
      if (input.status === "deposit_requested" && quote.customer) {
        const depositAmount = quote.depositAmount || quote.total;
        const paymentLink = `${process.env.APP_URL || "http://localhost:5000"}/pay/deposit/${quote.id}`;
        const emailHtml = depositRequestEmail(
          quote.customer.name,
          quote.referenceNo,
          depositAmount.toString(),
          paymentLink
        );
        await sendEmail({
          to: quote.customer.email,
          subject: `Deposit Payment Required - TMG Install (Ref: ${quote.referenceNo})`,
          html: emailHtml,
        });
      }
      
      res.json(quote);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.patch(api.quotes.updatePayment.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const input = api.quotes.updatePayment.input.parse(req.body);
      const quote = await storage.updateQuotePayment(id, input.paymentType, input.amount);
      if (!quote) return res.status(404).json({ message: "Quote not found" });
      res.json(quote);
    } catch (err) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.patch(api.quotes.updateBooking.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const input = api.quotes.updateBooking.input.parse(req.body);
      const quote = await storage.updateQuoteBooking(id, new Date(input.scheduledAt), input.timeWindow);
      if (!quote) return res.status(404).json({ message: "Quote not found" });
      
      // Send booking confirmation email
      if (quote.customer) {
        const dateStr = new Date(quote.scheduledAt!).toLocaleDateString("en-US", { 
          weekday: "long", 
          year: "numeric", 
          month: "long", 
          day: "numeric" 
        });
        const emailHtml = bookingConfirmationEmail(
          quote.customer.name,
          quote.referenceNo,
          quote.serviceAddress,
          dateStr,
          quote.timeWindow || "TBD"
        );
        await sendEmail({
          to: quote.customer.email,
          subject: `Booking Confirmed - TMG Install (Ref: ${quote.referenceNo})`,
          html: emailHtml,
        });
      }
      
      res.json(quote);
    } catch (err) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  // Final payment request email
  app.post("/api/quotes/:id/request-final-payment", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const quote = await storage.getQuote(id);
      
      if (!quote || !quote.customer) {
        return res.status(404).json({ message: "Quote not found" });
      }

      const finalAmount = quote.finalAmount || quote.total;
      const paymentLink = `${process.env.APP_URL || "http://localhost:5000"}/pay/final/${quote.id}`;
      
      const emailHtml = finalPaymentEmail(
        quote.customer.name,
        quote.referenceNo,
        finalAmount.toString(),
        paymentLink
      );

      const emailSent = await sendEmail({
        to: quote.customer.email,
        subject: `Final Payment Due - TMG Install (Ref: ${quote.referenceNo})`,
        html: emailHtml,
      });

      // Update quote status
      const updated = await storage.updateQuoteStatus(id, "final_payment_requested", {
        actorType: "admin",
        note: "Final payment request sent to customer"
      });

      res.json({ success: emailSent, quote: updated });
    } catch (err) {
      console.error("Error requesting final payment:", err);
      res.status(500).json({ message: "Failed to request final payment" });
    }
  });

  return httpServer;
}
