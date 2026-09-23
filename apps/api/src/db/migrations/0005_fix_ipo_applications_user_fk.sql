ALTER TABLE "ipo_applications" DROP CONSTRAINT "ipo_applications_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "ipo_applications" ADD CONSTRAINT "ipo_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
