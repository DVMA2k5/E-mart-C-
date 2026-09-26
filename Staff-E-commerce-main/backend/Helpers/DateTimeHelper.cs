namespace backend.Helpers
{
    
    public static class DateTimeHelper
    {
        private const int VietnamUtcOffset = 7;

      
        public static DateTime UtcNow => DateTime.UtcNow;

        
        public static DateTime VietnamNow => DateTime.UtcNow.AddHours(VietnamUtcOffset);

      
        public static DateTime VietnamToday => VietnamNow.Date;

     
        public static DateTime ToVietnamTime(DateTime utcDateTime)
        {
            return utcDateTime.AddHours(VietnamUtcOffset);
        }

       
        public static DateTime? ToVietnamTime(DateTime? utcDateTime)
        {
            return utcDateTime?.AddHours(VietnamUtcOffset);
        }

        public static DateTime ToUtc(DateTime vietnamDateTime)
        {
            return vietnamDateTime.AddHours(-VietnamUtcOffset);
        }

       
        public static DateTime? ToUtc(DateTime? vietnamDateTime)
        {
            return vietnamDateTime?.AddHours(-VietnamUtcOffset);
        }

        public static string FormatVietnam(DateTime? utcDateTime, string format = "dd/MM/yyyy")
        {
            if (!utcDateTime.HasValue) return "N/A";
            return ToVietnamTime(utcDateTime.Value).ToString(format);
        }

      
        public static string FormatVietnamDateTime(DateTime? utcDateTime)
        {
            return FormatVietnam(utcDateTime, "dd/MM/yyyy HH:mm");
        }

      
        public static bool IsExpired(DateTime? utcEndDate)
        {
            if (!utcEndDate.HasValue) return false;
            return ToVietnamTime(utcEndDate.Value).Date < VietnamToday;
        }

        public static bool IsScheduled(DateTime? utcStartDate)
        {
            if (!utcStartDate.HasValue) return false;
            return ToVietnamTime(utcStartDate.Value).Date > VietnamToday;
        }

        public static bool IsWithinRange(DateTime? utcStartDate, DateTime? utcEndDate)
        {
            var today = VietnamToday;
            var startOk = !utcStartDate.HasValue || ToVietnamTime(utcStartDate.Value).Date <= today;
            var endOk = !utcEndDate.HasValue || ToVietnamTime(utcEndDate.Value).Date >= today;
            return startOk && endOk;
        }
    }
}
