-- W3 integration integrity repair: portfolio rows must point at optimised
-- public assets, not raw camera uploads. Safe to run repeatedly.

update public.portfolio_items
   set image_url = case image_url
     when '/photos/IMG_2536.JPG' then '/photos/IMG_2536.optimised.jpg'
     when '/photos/IMG_2561.JPG' then '/photos/IMG_2561.optimised.jpg'
     when '/photos/IMG_2626.JPG' then '/photos/IMG_2626.optimised.jpg'
     when '/photos/IMG_2637.JPG' then '/photos/IMG_2637.optimised.jpg'
     when '/photos/IMG_2646.JPG' then '/photos/IMG_2646.optimised.jpg'
     when '/photos/IMG_3688.JPG' then '/photos/IMG_3688.optimised.jpg'
     else image_url
   end
 where image_url in (
   '/photos/IMG_2536.JPG',
   '/photos/IMG_2561.JPG',
   '/photos/IMG_2626.JPG',
   '/photos/IMG_2637.JPG',
   '/photos/IMG_2646.JPG',
   '/photos/IMG_3688.JPG'
 );

delete from public.portfolio_items
 where image_url in ('/photos/IMG_3715.JPG', '/photos/IMG_3715.optimised.jpg');

select sort_order, category, title_en, image_url
  from public.portfolio_items
 where image_url in (
   '/photos/IMG_2536.optimised.jpg',
   '/photos/IMG_2561.optimised.jpg',
   '/photos/IMG_2626.optimised.jpg',
   '/photos/IMG_2637.optimised.jpg',
   '/photos/IMG_2646.optimised.jpg',
   '/photos/IMG_3688.optimised.jpg',
   '/photos/IMG_3715.JPG',
   '/photos/IMG_3715.optimised.jpg'
 )
 order by sort_order;
